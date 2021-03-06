const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)

const SLACK_TOKEN = process.env.SLACK_TOKEN
const channel = "github-actiontest"

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
const branchHeadsUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs/heads/"
const newBranchUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs"
const slackUrl="https://slack.com/api/chat.postMessage"

const reviewers = "../prmeta.json"
const prMeta = require(reviewers)

const githubAuth =
  "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")

const getSlackAuth = "Bearer " + global.Buffer.from(SLACK_TOKEN).toString()

const githubPullRequestUrl = "https://api.github.com/repos/mustafayalniz-dev/demo0.3/pulls"

var trainBranchName = process.argv.slice(2)[0]

if (trainBranchName === "") {
  console.log("You need to give train branch name as parameter...")
  return 1
}

async function main() {

  await createBranchAndApplyCommits()

}

main()

async function commitConflict(setEmail, setIdentity, addAll, commitAll, pushTargetBranch) {
  try {
      const { error, stdout, stderr } = await exec(`${setEmail} && ${setIdentity} &&  ${addAll} && ${commitAll} && ${pushTargetBranch}`)
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
      return true
  } catch (error) {
      console.log("error:", error)
      return false
  }
}

async function headersWithAuthGithub(headers) {
  const auth = "token " + CREATE_BRANCH_TOKEN
  return Object.assign(headers, { Authorization: auth })
}

async function createBranchAndApplyCommits() {

  let newBranchNameSuffix = Math.random().toString(36).substring(7);
 
  var merge_commit_sha=event.pull_request.merge_commit_sha
  
  const fetchTarget = `git fetch`
  const checkoutTrainBranchTarget = `git checkout ${trainBranchName}`
  const pullTrainBranchTarget = `git pull origin ${trainBranchName}`
  newBranchFromTrainBranch=trainBranchName + "_" + newBranchNameSuffix 
  const createBranchFromTrainBranch = `git checkout -b ${newBranchFromTrainBranch}`
  const pushNewBranchFromTrainBranch = `git push origin ${newBranchFromTrainBranch}`

  const checkoutNewTargetBranch = `git checkout ${newBranchFromTrainBranch}`
  const cherryPick = `git cherry-pick -m 1 ${merge_commit_sha}`
  const pushNewTargetBranch = `git push origin ${newBranchFromTrainBranch}`

  const setEmail = `git config --global user.email "githubaction@spin.pm"`
  const setIdentity = `git config --global user.name "Spin Github Action"`
  const addAll = `git add -A`
  const commitAll = `git commit -m "Github Action commits conflict"`

  var branchCreateSuccess=false

  try {
    const { error, stdout, stderr } = await exec(`${fetchTarget} && ${checkoutTrainBranchTarget} && ${pullTrainBranchTarget} && ${setEmail} && ${setIdentity} && ${createBranchFromTrainBranch} && ${pushNewBranchFromTrainBranch}`)
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
    branchCreateSuccess=true
  } catch (error) {
    console.log("error: " + error)
    console.log("New branch creation from " + trainBranchName + " failed. Exiting...")
    return
  }

  var cherryPickSuccess=false
  var conflictHappened = false

  try {
    const { error, stdout, stderr } = await exec(`${fetchTarget} && ${checkoutNewTargetBranch} && ${setEmail} && ${setIdentity} && ${cherryPick} && ${pushNewTargetBranch}`)
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
    cherryPickSuccess=true
  } catch (error) {
    console.log("error:", error)
    if (error.message.includes("conflicts")) {
      conflictHappened = true
      console.log("Conflict occured while cherry picking, now pushing conflict into new branch...")
      cherryPickSuccess=await commitConflict(setEmail, setIdentity, addAll, commitAll, pushNewTargetBranch)
    }
  }

  if ( cherryPickSuccess ) {
     console.log("Proceeding to PR")
     var originPRTitle=event.pull_request.title
     sourceBranchName=newBranchFromTrainBranch
     pr_result=await createPullRequest(trainBranchName, sourceBranchName, originPRTitle, conflictHappened)

     if ( pr_result.number ) { 
	console.log("PR creation success... Url: " + pr_result.url)
        add_reviewer_result = await addReviewerToPullRequest(pr_result.number)
        console.log(add_reviewer_result)
        if ( add_reviewer_result.url ) {
		console.log("Reviewers added with success... Pr url " + add_reviewer_result.url)
	} else {
		console.log("Reviewers could not be added. Failed...")
                slack_response=await postSlackMessage(channel, "Reviewers could not be added to PR " + pr_result.url + " Please check...")
//		return 
        }
     } else {
	console.log("PR creation failed")
        slack_response=await postSlackMessage(channel, "PR creation failed from " + newBranchFromTrainBranch + " to " + trainBranchName + "Please check...")
        return 
     }

     if ( conflictHappened ) {
          slack_response=await postSlackMessage(channel, "PR " + pr_result.url + " :" + originPRTitle + " posted with conflict. Need resolution")
          console.log(slack_response)
     } else {
          slack_response=await postSlackMessage(channel, "PR " + pr_result.url + " :" + originPRTitle + " posted without conflict.")
          console.log(slack_response)
     }
  } else {
     console.log("As cherry pick or conflict push not succeeded, PR creation cancelled...")
  }

}

async function createPullRequest(backBranchName, newSourceBranchName, originPRTitle, conflictHappened) {
  console.log("We PR from " + newSourceBranchName + " " + backBranchName + " " + originPRTitle)

  if ( conflictHappened ) {
     title = `Pulling "${originPRTitle}" from ${newSourceBranchName} into ${backBranchName} with conflict`
  } else {
     title = `Pulling "${originPRTitle}" from ${newSourceBranchName} into ${backBranchName} without conflict`
  }

  const requestBody = {
    title: `${title}`,
    head: newSourceBranchName,
    base: backBranchName,
    body: `Automated PR to get changes over to ${backBranchName}. Please resolve conflicts before merging!`,
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

async function addReviewerToPullRequest(pullRequestNumber) {

  reviewersArray = { "reviewers": prMeta.prReviewers.split(",") }

  console.log(reviewersArray)
  githubNewPullRequestUrl=githubPullRequestUrl + "/" + pullRequestNumber + "/requested_reviewers"
  console.log(githubNewPullRequestUrl)
  const response = await fetch(githubNewPullRequestUrl, {
    method: "post",
    body: JSON.stringify(reviewersArray),
    headers: { Authorization: githubAuth, Accept: "application/vnd.github.v3+json", "User-Agent": "RT-Project-Agent" },
  })
  return await response.json()
}


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
