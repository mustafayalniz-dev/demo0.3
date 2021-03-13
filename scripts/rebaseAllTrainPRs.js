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
	console.log("Next PR " + commitsUrl )
        var commit_list = await getCommitListInPR(commitsUrl)
        var originalPRUrl = prList[pr].url
        var originPRTitle = prList[pr].title
        var originPRBody = prList[pr].body
 
        console.log("Check here PR Content... title:" + originPRTitle + " body: " + originPRBody )
//        console.log(prList[pr])
        const fetchTarget = `git fetch`
        const originalBranchName=prList[pr].head.ref
        const newBranchName=getNewbranchName(originalBranchName)
        checkoutTrainBranch = `git checkout ${trainBranchName}`
        pullTrainBranch=`git pull origin ${trainBranchName}`
        checkoutCreatePrSourceBranch = `git checkout -b ${newBranchName}`
        await exec(`${fetchTarget} && ${checkoutTrainBranch} && ${pullTrainBranch} && ${checkoutCreatePrSourceBranch} && ${setEmail} && ${setIdentity}`)

        var conflictHappened = false

        for (index = 0; index < commit_list.length; index++) { 
           console.log("Applying commit " + commit_list[index] + " to branch " + newBranchName)
           const cherryPick = `git cherry-pick -m 1 ${commit_list[index]}`
           try {
               const { error, stdout, stderr } = await exec(`${cherryPick}`)
               console.log('stdout:', stdout);
               console.log('stderr:', stderr);
               cherryPickSuccess=true
           } catch (error) {
               console.log("error:", error)
               if (error.message.includes("conflicts")) {
                   conflictHappened = true
                   console.log("Conflict occured while cherry picking, now pushing conflict " + commit_list[index] + " into new branch...")
                   cherryPickSuccess=await commitConflict(addAll, commitAll)
               }
           }
        }
        const pushPrSourceBranch = `git push origin ${newBranchName}`
        closePullRequest(originalPRUrl)
        deleteLocalBranch=`git branch -d ${originalBranchName}`
        deleteRemoteBranch=`git push origin --delete ${originalBranchName}`
        try {
            const { error, stdout, stderr } = await exec(`${deleteLocalBranch} && ${deleteRemoteBranch}`)
            console.log('stdout:', stdout);
            console.log('stderr:', stderr);
        } catch (error) {
            console.log("error:", error)
        }
        createPullRequest(trainBranchName, newBranchName, originPRTitle, originPRBody, conflictHappened)
   }



}

main()

async function commitConflict(addAll, commitAll) {
  try {
      const { error, stdout, stderr } = await exec(`${addAll} && ${commitAll}`)
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
      return true
  } catch (error) {
      console.log("error:", error)
      return false
  }
}


async function listPullRequests(trainBranchName) {

  githubPullRequestUrlWithBase=githubPullRequestUrl + "?base=" + trainBranchName

  const response = await fetch(githubPullRequestUrlWithBase, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
  return await response.json()
}

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

async function commitConflict(addAll, commitAll) {
  try {
      const { error, stdout, stderr } = await exec(`${addAll} && ${commitAll}`)
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

async function createPullRequest(backBranchName, newSourceBranchName, originPRTitle, originPRBody, conflictHappened) {
  console.log("We PR from " + newSourceBranchName + " " + backBranchName + " " + originPRTitle)

  if ( conflictHappened ) {
     title = `${originPRTitle} - Pulling "${originPRTitle}" from ${newSourceBranchName} into ${backBranchName} with conflict`
     body = `Automated PR to rebase new ${backBranchName} branch changes over to ${backBranchName}. Please resolve conflicts before merging! - ${originPRBody}`
  } else {
     title = `${originPRTitle} - Pulling "${originPRTitle}" from ${newSourceBranchName} into ${backBranchName} without conflict`
     body = `Automated PR to rebase new ${backBranchName} branch changes over to ${backBranchName}. Please resolve conflicts before merging! - ${originPRBody}`
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



