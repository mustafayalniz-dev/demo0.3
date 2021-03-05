const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)

const SLACK_TOKEN = process.env.SLACK_TOKEN
const channel = "ask-it-support"

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
const branchHeadsUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs/heads/"
const newBranchUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs"
const slackUrl="https://slack.com/api/chat.postMessage"
const slackWebHookUrl="https://hooks.slack.com/services/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"

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
  
   var merge_commit_sha=event.pull_request.merge_commit_sha

   for ( pr in prList ) {
   
       const fetchTarget = `git fetch`
       checkoutPrSourceBranch = `git checkout ${prList[pr].head.ref}`
       const cherryPick = `git cherry-pick -m 1 ${merge_commit_sha}`
       const pushPrSourceBranch = `git push origin ${prList[pr].head.ref}`

       const setEmail = `git config --global user.email "githubaction@spin.pm"`
       const setIdentity = `git config --global user.name "Spin Github Action"`
       const addAll = `git add -A`
       const commitAll = `git commit -m "Github Action commits conflict"`

       console.log("PR Head : " + prList[pr].head.ref)

       var cherryPickSuccess=false
       var conflictHappened = false

      try {
          const { error, stdout, stderr } = await exec(`${fetchTarget} && ${checkoutPrSourceBranch} && ${setEmail} && ${setIdentity} && ${cherryPick} && ${pushPrSourceBranch}`)
          console.log('stdout:', stdout);
          console.log('stderr:', stderr);
          cherryPickSuccess=true
      } catch (error) {
          console.log("error:", error)
          if (error.message.includes("conflicts")) {
              conflictHappened = true
              console.log("Conflict occured while cherry picking, now pushing conflict into new branch...")
              cherryPickSuccess=await commitConflict(setEmail, setIdentity, addAll, commitAll, pushPrSourceBranch)
          }
      }

      if ( cherryPickSuccess ) {
	  console.log("Merge commit successfully applied to branch : " + prList[pr].head.ref + " with success")
      } else {
	  console.log("Merge commit cannot be applied to branch : " + prList[pr].head.ref )
      } 

     if ( conflictHappened ) {
          slack_response=await postSlackMessage(channel, "Branch " + prList[pr].head.ref + " has been updated with latest commit on train branch. Conflict happened. Need resolution")
          console.log(slack_response)
     } else {
          slack_response=await postSlackMessage(channel, "Branch " + prList[pr].head.ref + " has been updated with latest commit on train branch. Merge was clean. No conflict")
          console.log(slack_response)
     }

   }
}

main()


async function listPullRequests(trainBranchName) {

  githubPullRequestUrlWithBase=githubPullRequestUrl + "?base=" + trainBranchName

  const response = await fetch(githubPullRequestUrlWithBase, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
  return await response.json()
}


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

async function postSlackMessage(channel, message) {

  const requestBody = {
        text: message
  }

  const response = await fetch(slackWebHookUrl, {
       method: "post",
       body: JSON.stringify(requestBody),
       headers: { "Content-type": "application/json", "User-Agent": "RT-Project-Agent" },
  })

  return response

}

