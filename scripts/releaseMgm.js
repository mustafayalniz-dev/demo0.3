const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)
var jiraUtils = require("./jira-utils")

const SLACK_TOKEN = process.env.SLACK_TOKEN
const channel = "github-actiontest"

const jiraCreate=false

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN
const slackUrl="https://slack.com/api/chat.postMessage"

var selectedFunction = process.argv.slice(2)[0]

const githubAuth =
  "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")

const githubPullRequestUrl = "https://api.github.com/repos/mustafayalniz-dev/demo0.3/pulls"

const getSlackAuth = "Bearer " + global.Buffer.from(SLACK_TOKEN).toString()

async function main() {
    if ( selectedFunction == "release-start") {
	await releaseStart()
    } else if (selectedFunction == "auto-merge") {
	await mergeMasterIntoIntegration()
    } else if (selectedFunction == "code-complete") {
	response=await codeComplete()
        console.log("PR creation response below...")
        if ( response.url ) {
        	reviewer_response=await addReviewerToPullRequest(response.url)
        }
    }
}

main()

async function addReviewerToPullRequest(prUrl) {
     const reviewers = "../prmeta.json"
     const prMeta = require(reviewers)

     reviewersArray = { "reviewers": prMeta.qaReviewers.split(",") }

     console.log(reviewersArray)
     githubNewPullRequestUrl=prUrl + "/requested_reviewers"
     console.log(githubNewPullRequestUrl)
     const response = await fetch(githubNewPullRequestUrl, {
        method: "post",
        body: JSON.stringify(reviewersArray),
        headers: { Authorization: githubAuth, Accept: "application/vnd.github.v3+json", "User-Agent": "RT-Project-Agent" },
     })
     return await response.json()
}


async function codeComplete() {

      const fetchTarget = `git fetch`
      const checkoutMaster = `git checkout master`
      await exec(`${fetchTarget} && ${checkoutMaster}`)

      const release = "../.release-version.json"
      const releaseVersion = require(release)

      console.log(releaseVersion.version)

      const integrationBranch = "integration_" + releaseVersion.version
      
      const title="PR from " + integrationBranch + " to master at code complete date."

      const requestBody = {
         title: `${title}`,
         head: integrationBranch,
         base: "master",
         body: `Automated PR created at code complete date from ${integrationBranch} to master.!`,
      }
      console.log(requestBody)
      console.log(githubPullRequestUrl)

      const response = await fetch(githubPullRequestUrl, {
         method: "post",
         body: JSON.stringify(requestBody),
         headers: { Authorization: githubAuth },
      })
  
      return await response.json()

}


async function mergeMasterIntoIntegration() {

      const fetchTarget = `git fetch`
      const checkoutMaster = `git checkout master`
      const pullMaster = `git pull origin master --allow-unrelated-histories`
      await exec(`${fetchTarget} && ${checkoutMaster} && ${pullMaster}`)

      const release = "../.release-version.json"
      const releaseVersion = require(release)
      const integrationBranch = "integration_" + releaseVersion.version

      console.log(releaseVersion.version)

      const setEmail = `git config --global user.email "githubaction@spin.pm"`
      const setIdentity = `git config --global user.name "Spin Github Action"`
      const setPolicy = `git config pull.rebase false`
      const checkoutIntegrationBranch = `git checkout ${integrationBranch}`
      const pullIntegrationBranch = `git pull origin ${integrationBranch} --allow-unrelated-histories`
      const mergeMasterIntoIntegration = `git merge master -m "auto merge master into ${integrationBranch} upon new commit into master" --allow-unrelated-histories`
      const pushIntegrationBranch = `git push origin ${integrationBranch}`

      const addAll = `git add -A`
      const commitAll = `git commit -m "Github Action commits conflict"`

      var mergeSuccess=false
      var conflictHappened = false
      try {
          const { error, stdout, stderr } = await exec(`${setEmail} && ${setIdentity} && ${checkoutIntegrationBranch} && ${setPolicy} && ${pullIntegrationBranch} && ${mergeMasterIntoIntegration} && ${pushIntegrationBranch}`)
//          console.log('stdout:', stdout);
//          console.log('stderr:', stderr);
          conflictHappened = false
          mergeSuccess=true
      } catch (error) {
//          console.log("error:", error)
          if (error.stdout.includes("conflicts")) {
              conflictHappened = true
              console.log("Conflict occured while merging master into " + integrationBranch + ", now pushing conflict content into new branch...")
              mergeSuccess=await commitConflict(addAll, commitAll, pushIntegrationBranch)
              if ( mergeSuccess && jiraCreate ) {
                  var createJiraResponse = await jiraUtils.createJiraIssueForConflict("Rider Experience", "mustafa", "10004", "Conflict occured while merging master into " + integrationBranch)
                  createJiraResponseJson = await createJiraResponse.json()
                  console.log(createJiraResponseJson.key)
                  if ( createJiraResponseJson.key )  {
			console.log("Jira issue created: " + createJiraResponseJson.key )
                        var issueUrl=jiraUtils.baseUrl + jiraUtils.issueBaseUrl + createJiraResponseJson.key
 			slack_response=await postSlackMessage(channel, "Conflict occured while merging master into " + integrationBranch + " Jira issue created. Check here: " + issueUrl)
		  }
              }
          } else {
	      mergeSuccess=false
	  }
      }

      if ( mergeSuccess ) {
          if ( conflictHappened ) {
	  	console.log("Master merged into " + integrationBranch + " with conflict")
//                slack_response=await postSlackMessage(channel, "Conflict occured while merging master into " + integrationBranch )
	  } else {
	  	console.log("Master merged into " + integrationBranch + " without conflict")
                slack_response=await postSlackMessage(channel, "Merged master into " + integrationBranchy + " without conflict")
	  }
      }
      return mergeSuccess

}

async function releaseStart() {
      
      const fetchTarget = `git fetch`
      const checkoutMaster = `git checkout master`
      await exec(`${fetchTarget} && ${checkoutMaster}`)

      const release = "../.release-version.json"
      const releaseVersion = require(release)

      console.log(releaseVersion.version)

      let major = parseInt(releaseVersion.version.replace(/(\d+)\.(\d+)\.(\d+)/, "$1"))
      let minor = parseInt(releaseVersion.version.replace(/(\d+)\.(\d+)\.(\d+)/, "$2"))
      let patch = parseInt(releaseVersion.version.replace(/(\d+)\.(\d+)\.(\d+)/, "$3"))

      minor=minor+1

      newVersion=major + "." + minor + "." + patch
      newIntegrationBranch="integration_" + newVersion

      console.log(newIntegrationBranch)

      const addVersionFile = `git add .release-version.json`
      const commitVersionFile = `git commit -m "bumped application version to ${newVersion}"`
      const pushVersionFile = `git push origin master`
      const setEmail = `git config --global user.email "githubaction@spin.pm"`
      const setIdentity = `git config --global user.name "Spin Github Action"`
      const createNewIntegrationBranch = `git checkout -b ${newIntegrationBranch}`
      const pushNewIntegrationBranch = `git push origin ${newIntegrationBranch}`

      newReleaseContent = { "version": newVersion }

      let newReleaseContentJson = JSON.stringify(newReleaseContent)
      fs.writeFileSync('.release-version.json', newReleaseContentJson)

      var success=false
      try {
          const { error, stdout, stderr } = await exec(`${fetchTarget} && ${checkoutMaster} &&  ${addVersionFile} &&${setEmail} && ${setIdentity} && ${commitVersionFile} &&  ${pushVersionFile} && ${createNewIntegrationBranch} && ${pushNewIntegrationBranch}`)
          console.log('stdout:', stdout);
          console.log('stderr:', stderr);
          success=true
      } catch (error) {
          console.log("error:", error)
          success=false
      }

      return success
}


async function commitConflict(addAll, commitAll, pushIntegrationBranch) {
  try {
      const { error, stdout, stderr } = await exec(`${addAll} && ${commitAll} && ${pushIntegrationBranch}`)
//      console.log('stdout:', stdout);
//      console.log('stderr:', stderr);
      return true
  } catch (error) {
      console.log("error:", error)
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

