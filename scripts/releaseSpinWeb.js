const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)
var jiraUtils = require("./jira-short")

// Documentation https://spinbikes.atlassian.net/wiki/spaces/EN/pages/426901984/Release+Train#Spin-web-Integration-Branches%3A
// Demo Spin-Web https://spinbikes.atlassian.net/wiki/spaces/EN/pages/1240335622/Rider+App+Automation+Demo+2
// PRs that trigger this should have label: rt-2.0-spin-web

const SLACK_TOKEN = process.env.SLACK_TOKEN
const channel = "github-actiontest"

const jiraCreate=true

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const slackUrl="https://slack.com/api/chat.postMessage"
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))

var selectedFunction = process.argv.slice(2)[0]
var commit = process.argv.slice(2)[1]

const githubAuth =
  "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")

const githubPullRequestUrl = "https://api.github.com/repos/mustafayalniz-dev/demo0.3/pulls"

const getSlackAuth = "Bearer " + global.Buffer.from(SLACK_TOKEN).toString()

const setEmail = `git config --global user.email "githubaction@spin.pm"`
const setIdentity = `git config --global user.name "Spin Github Action"`
const addAll = `git add -A`
const commitAll = `git commit -m "Github Action commits conflict"`
const setStrategy = `git config --global merge.ours.driver true`
const fetchTarget = `git fetch`
const checkoutMaster = `git checkout master`

async function main() {
     
    const versionsJson = "../.release-version.json"
    const versions = require(versionsJson)

    const masterVersion = versions.master
    const qaVersion = versions.qa
    const qaSoftVersion = versions.soft_qa

    const merge_commit_sha = event.pull_request.merge_commit_sha

    console.log("merge_commit_sha: " + merge_commit_sha)
    console.log("github.sha: " + commit )

    if ( selectedFunction == "release-start") {
	await releaseStart(versions)
    } else if (selectedFunction == "auto-merge") {
	await mergeMasterIntoIntegration(qaVersion, merge_commit_sha)
	await mergeMasterIntoIntegration(qaSoftVersion, merge_commit_sha)
    }
}

main()

async function addReviewerToPullRequest(prUrl) {
     const reviewers = "../prmeta.json"
     const prMeta = require(reviewers)

     reviewersArray = { "reviewers": prMeta.qaReviewers.split(",") }

     githubNewPullRequestUrl=prUrl + "/requested_reviewers"
     const response = await fetch(githubNewPullRequestUrl, {
        method: "post",
        body: JSON.stringify(reviewersArray),
        headers: { Authorization: githubAuth, Accept: "application/vnd.github.v3+json", "User-Agent": "RT-Project-Agent" },
     })
     return await response.json()
}


async function createNewPR(integrationBranch) {
      
      const title="PR from " + integrationBranch + " to master at code complete date."

      const requestBody = {
         title: `${title}`,
         head: integrationBranch,
         base: "master",
         body: `Automated PR created at code complete date from ${integrationBranch} to master.!`,
      }

      const response = await fetch(githubPullRequestUrl, {
         method: "post",
         body: JSON.stringify(requestBody),
         headers: { Authorization: githubAuth },
      })
  
      return await response.json()

}


async function mergeMasterIntoIntegration(integrationVersion, merge_commit_sha) {

      const integrationBranch = "integration_" + integrationVersion

      console.log("Merging commit to " + integrationBranch )

      await exec(`${setStrategy}`)

      cherryPickResult = await executeCherryPick(integrationBranch, merge_commit_sha)

      var mergeSuccess=cherryPickResult[0]
      var conflictHappened = cherryPickResult[1]

      if ( mergeSuccess ) {
          if ( conflictHappened ) {
                console.log("Master merged into " + integrationBranch + " with conflict")
                slack_response=await postSlackMessage(channel, "Conflict occured while merging master into " + integrationBranch )
          } else {
                console.log("Master merged into " + integrationBranch + " without conflict")
                slack_response=await postSlackMessage(channel, "Merged master into " + integrationBranch + " without conflict")
          }
      }
      return mergeSuccess
}

async function executeCherryPick(integrationBranch, merge_commit_sha) {

      const setPolicy = `git config pull.rebase false`
      const checkoutIntegrationBranch = `git checkout ${integrationBranch}`
      const pullIntegrationBranch = `git pull origin ${integrationBranch}`
      const cherryPick = `git cherry-pick -m 1 ${merge_commit_sha}`
      const pushIntegrationBranch = `git push origin ${integrationBranch}`

      var mergeSuccess = false
      var conflictHappened = false

      try {
          const { error, stdout, stderr } = await exec(`${fetchTarget} && ${setEmail} && ${setIdentity} && ${checkoutIntegrationBranch} && ${pullIntegrationBranch} && ${cherryPick} && ${pushIntegrationBranch}`)
          conflictHappened = false
          mergeSuccess=true
      } catch (error) {
          console.log("error in push integration branch : " + error )
          cpErrorHandlingresult = await cherryPickFailureHandler(error, mergeSuccess, conflictHappened, pushIntegrationBranch)
          mergeSuccess = cpErrorHandlingresult[0]
          conflictHappened = cpErrorHandlingresult[1]
      }

      cpResult = [mergeSuccess, conflictHappened]

      return cpResult

}

async function cherryPickFailureHandler(error, mergeSuccess, conflictHappened, pushIntegrationBranch) {

      console.log("error in push integration branch : " + error )

      if (error.message.includes("conflicts")) {
          conflictHappened = true
          console.log("Conflict occured while merging master into " + integrationBranch + ", now pushing conflict content into new branch...")
          mergeSuccess=await commitConflict(addAll, commitAll, pushIntegrationBranch)
          if ( mergeSuccess && jiraCreate ) {
              var createJiraResponse = await jiraUtils.createJiraIssueForConflict("Rider Experience", "mustafa", "10004", "Conflict occured while merging master into " + integrationBranch)
              createJiraResponseJson = await createJiraResponse.json()
              if ( createJiraResponseJson.key )  {
                    console.log("Jira issue created: " + createJiraResponseJson.key )
                    var issueUrl=jiraUtils.baseUrl + jiraUtils.issueBaseUrl + createJiraResponseJson.key
                    slack_response=await postSlackMessage(channel, "Conflict occured while merging master into " + integrationBranch + " Jira issue created. Check here: " + issueUrl)
              }
          }
      } else {
          mergeSuccess=false
      }

      cpErrorhandlingResult = [mergeSuccess, conflictHappened]

      return cpErrorhandlingResult
}

async function getNewReleaseContent(versions) {

      const masterVersion = versions.master
      const qaVersion = versions.qa
      const qaSoftVersion = versions.soft_qa

      console.log("Master Version : " + masterVersion)
      console.log("QA Version : " + qaVersion)
      console.log("Soft QA Version : " + qaSoftVersion)

      let major = parseInt(qaSoftVersion.replace(/(\d+)\.(\d+)\.(\d+)/, "$1"))
      let minor = parseInt(qaSoftVersion.replace(/(\d+)\.(\d+)\.(\d+)/, "$2"))
      let patch = parseInt(qaSoftVersion.replace(/(\d+)\.(\d+)\.(\d+)/, "$3"))

      minor=minor
      newMasterVersion = major + "." + minor + "." + patch

      minor=minor+1
      newQAVersion = major + "." + minor + "." + patch

      minor=minor+1
      newQASoftVersion = major + "." + minor + "." + patch

      newVersions = [newMasterVersion, newQAVersion, newQASoftVersion ]

      return newVersions
}

async pushAndCreatePR(qaVersion, createNewIntegrationBranch, addVersionFile, commitVersionFile, pushNewIntegrationBranch) {

      var success=false
      try {
          const { error, stdout, stderr } = await exec(`${fetchTarget} && ${checkoutMaster} && ${setEmail} && ${setIdentity} && ${createNewIntegrationBranch} &&  ${addVersionFile} && ${commitVersionFile} && ${pushNewIntegrationBranch}`)
          success=true
      } catch (error) {
          console.log("error:", error)
          success=false
      }

      const newPullRequestBranch = "integration_" + qaVersion

      if ( success ) {
          var prResponse = await createNewPR(newPullRequestBranch)
          if ( prResponse.url ) {
                reviewer_response=await addReviewerToPullRequest(prResponse.url)
                console.log("Reviewer Response : " + reviewer_response)
          }
      }
      return success

}

async function releaseStart(versions) {
      
      await exec(`${fetchTarget} && ${checkoutMaster}`)

      const qaVersion = versions.qa
      const qaSoftVersion = versions.soft_qa

      newIntegrationBranch="integration_" + qaSoftVersion

      newVersions = await getNewReleaseContent(versions)

      const addVersionFile = `git add .release-version.json`
      const commitVersionFile = `git commit -m "bumped application version in ${newIntegrationBranch} to ${newVersions[0]}"`
      const createNewIntegrationBranch = `git checkout -b ${newIntegrationBranch}`
      const pushNewIntegrationBranch = `git push origin ${newIntegrationBranch}`

      newReleaseContent = { "master": newVersions[0], "qa": newVersions[1], "soft_qa": newVersions[2] }
      let newReleaseContentJson = JSON.stringify(newReleaseContent)
      fs.writeFileSync('.release-version.json', newReleaseContentJson)

      var success = await pushAndCreatePR(qaVersion, createNewIntegrationBranch, addVersionFile, commitVersionFile, pushNewIntegrationBranch)

      return success
}


async function commitConflict(addAll, commitAll, pushIntegrationBranch) {
  try {
      const { error, stdout, stderr } = await exec(`${addAll} && ${commitAll} && ${pushIntegrationBranch}`)
      return true
  } catch (error) {
      console.log("Error while commiting conflict:", error)
      return false
  }
}


//
// Post slack message into specified channel
//
async function postSlackMessage(channel, message) {

  const requestBody = {
        channel: channel,
        text: message
  }

  const response = await fetch(slackUrl, {
       method: "post",
       body: JSON.stringify(requestBody),
       headers: { Authorization: getSlackAuth, "Content-type": "application/json", "User-Agent": "RT-Project-Agent" },
  })

  return await response.json()

}

