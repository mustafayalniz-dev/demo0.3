const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)
var jiraUtils = require("./jira-utils")

const SLACK_TOKEN = process.env.SLACK_TOKEN
const channel = "github-actiontest"
const jiraCreate = false

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
const branchHeadsUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs/heads/"
const newBranchUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs"
const slackUrl="https://slack.com/api/chat.postMessage"

const githubAuth =
  "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")
const githubPullRequestUrl = "https://api.github.com/repos/mustafayalniz-dev/demo0.3/pulls"

const getSlackAuth = "Bearer " + global.Buffer.from(SLACK_TOKEN).toString()

var trainBranchName = process.argv.slice(2)[0]

if (trainBranchName === "") {
  console.log("You need to give train branch name as parameter...")
  return 1
}

async function main() {

   var prList = await listPullRequests(trainBranchName)
  
   const setEmail = `git config --global user.email "githubaction@spin.pm"`
   const setIdentity = `git config --global user.name "Spin Github Action"`
   const addAll = `git add -A`
   const commitAll = `git commit -m "Github Action commits conflict"`

   for ( pr in prList ) {

        commitsUrl=prList[pr].commits_url
	console.log("Next PR commits URL " + commitsUrl )
        
	var commit_list = await getCommitListInPR(commitsUrl)
        var prUrlToUpdate = prList[pr].url
        var originalPRTitle = prList[pr].title
        var originalPRBody = prList[pr].body
 
        const fetchTarget = `git fetch`
        const originalBranchName=prList[pr].head.ref
        const newBranchName=await getNewbranchName(originalBranchName)
        checkoutTrainBranch = `git checkout ${trainBranchName}`
        pullTrainBranch=`git pull origin ${trainBranchName}`
        checkoutCreatePrSourceBranch = `git checkout -b ${newBranchName}`
 
        var newBranchSuccess = false
        try {
            const { error, stdout, stderr } =await exec(`${fetchTarget} && ${checkoutTrainBranch} && ${pullTrainBranch} && ${checkoutCreatePrSourceBranch} && ${setEmail} && ${setIdentity}`)
	    newBranchSuccess = true
	} catch ( error ) {
	    newBranchSuccess = false
	    console.log("error:", error)
	    continue
	}

        var conflictHappened = false

        for (index = 0; index < commit_list.length; index++) { 
           console.log("Applying commit " + commit_list[index] + " to branch " + newBranchName)
           const cherryPick = `git cherry-pick -m 1 ${commit_list[index]}`
           try {
               const { error, stdout, stderr } = await exec(`${cherryPick}`)
               cherryPickSuccess=true
           } catch (error) {
               if (error.message.includes("conflicts")) {
                   conflictHappened = true
                   console.log("Conflict occured while cherry picking, now pushing conflict " + commit_list[index] + " into new branch...")
                   cherryPickSuccess=await commitConflict(addAll, commitAll)
               }
           }
        }

        if ( ! cherryPickSuccess ) {
		continue
	}

	const forcePushToRemoteBranch = `git push origin --force ${newBranchName}:${originalBranchName}`

        var forcePushSourceBranchSuccess=false
        try {
            const { error, stdout, stderr } = await exec(`${fetchTarget} && ${forcePushToRemoteBranch}`)
            forcePushSourceBranchSuccess=true
        } catch (error) {
            forcePushSourceBranchSuccess=false
            console.log("error:", error)
        }
        if ( conflictHappened && forcePushSourceBranchSuccess) {
        	await postSlackMessage(channel, "PR " + prUrlToUpdate + " has been updated but has conflicts. Please resolve conflicts of rebasing...")
	        if ( jiraCreate ) {
                   var createJiraResponse = await jiraUtils.createJiraIssueForConflict("RDE", "mustafa", "Bug", "Conflict occured while updating PR: " + prUrlToUpdate)
                   console.log(createJiraResponse)
                   createJiraResponseJson = await createJiraResponse.json()
		   var jiraIssueUrl="https://spinbikes.atlassian.net/browse/" + createJiraResponseJson.key
		   var patchPRResponse = await patchPullRequest(prUrlToUpdate, originalPRTitle, originalPRBody, jiraIssueUrl)
		}
	} else if ( forcePushSourceBranchSuccess ) {
        	await postSlackMessage(channel, "PR " + prUrlToUpdate + " has been updated clean. Rebase was clean...")
	} else {
        	await postSlackMessage(channel, "PR " + prUrlToUpdate + " could not be updated...")
	}
   }

}

main()

//
// This method adds files with conflict and commits them all
//
async function commitConflict(addAll, commitAll) {
  try {
      const { error, stdout, stderr } = await exec(`${addAll} && ${commitAll}`)
      return true
  } catch (error) {
      console.log("error:", error)
      return false
  }
}


//
// This method list all pull requests whose target is train branch given as parameter to this js file
//
async function listPullRequests(trainBranchName) {

  githubPullRequestUrlWithBase=githubPullRequestUrl + "?base=" + trainBranchName

  const response = await fetch(githubPullRequestUrlWithBase, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
  return await response.json()
}

//
// List all Commit SHA's in this PR. Input as commits url
//
async function getCommitListInPR(commits_url) {

  const response = await fetch(commits_url, {
    method: "get",
    headers: { Authorization: githubAuth },
  })

  commits_list_response = await response.json()

  sha_list = []

  for (var commit in commits_list_response) {
      sha_list.push(commits_list_response[commit].sha)
  }

  return sha_list
  
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

//
// Create Github Pull Request
//
async function createPullRequest(backBranchName, newSourceBranchName, originalPRTitle, originalPRBody, conflictHappened) {
  console.log("We PR from " + newSourceBranchName + " " + backBranchName + " " + originalPRTitle)

  if ( conflictHappened ) {
     title = `${originalPRTitle}.`
     body = `${originalPRBody}`
  } else {
     title = `${originalPRTitle}`
     body = `${originalPRBody}`
  }

  const requestBody = {
    title: `${title}`,
    head: newSourceBranchName,
    base: backBranchName,
    body: `${body}`,
  }
  const response = await fetch(githubPullRequestUrl, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: { Authorization: githubAuth },
  })
  console.log("Printing PR creation response ...")
  console.log(response)
  return await response.json()
}

//
// Patch Github Pull Request
//
async function patchPullRequest(prUrlToUpdate, originalPRTitle, originalPRBody, jiraIssueUrl) {
  console.log("We are patching PR " + prUrlToUpdate + " with jira issue url : " + jiraIssueUrl )

  title = `${originalPRTitle}.`
  body = `${originalPRBody}`

  const requestBody = {
    body: `${body}\nCritical: Please check issue ${jiraIssueUrl} before merging"`,
  }
  const response = await fetch(prUrlToUpdate, {
    method: "patch",
    body: JSON.stringify(requestBody),
    headers: { Authorization: githubAuth },
  })
  console.log("Printing PR patching response ...")
  console.log(response)
  return await response.json()
}


// 
// Close existing pulll request that is expired.
// 
async function closePullRequest(pr_url) {

  const requestBody = {
    state: `closed`,
  }

  const response = await fetch(pr_url, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: { Authorization: githubAuth },
  })
  console.log("Printing PR closure response ..." + pr_url)
  console.log(response)
  return await response.json()

}

//
// Generate new name for branch
//
async function getNewbranchName(branchName) {
    var baseName=""
    var count=0

    if ( /^.+__(\d+)__$/.test(branchName) ) {
        console.log("match")
        var baseName = branchName.replace(/(.+)__\d+__/g, "$1");
        var count = branchName.replace(/.+__(\d+)__/g, "$1");
    } else {
        var baseName = branchName
        count = 0
    }

    newCount=parseInt(count)+1
    newBranchName=baseName + "__" + newCount + "__"

    return newBranchName

}



