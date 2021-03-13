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
        var commit_list = await getCommitListInPR(commitsUrl)
       
        console.log("Check here PR Content... ")
        console.log(prList[pr])
        return
        const fetchTarget = `git fetch`
        const originalBranchName=prList[pr].head.ref
        const newBranchName=getNewbranchName(originalBranchName)
        checkoutPrSourceBranch = `git checkout -b ${newBranchName}`
        await exec(`${fetchTarget} && ${checkoutPrSourceBranch} && ${setEmail} && ${setIdentity}`)

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
        createPullRequest(trainBranchName, newBranchName, originPRTitle, conflictHappened)
   	console.log("Commit list in PR")
        console.log(commitsUrl)
        console.log(commit_list)
	console.log("Next one")
   }

   var merge_commit_sha=event.pull_request.merge_commit_sha

   var commits_url=event.pull_request.commits_url

   var commit_list = await getCommitListInPR(commits_url)

//   console.log("Commit list in PR")
//   console.log(commit_list)

//   console.log(prList)

   return

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
          slack_response=await postSlackMessage(channel, "Merge commit:" + merge_commit_sha + " cannot be applied to branch " + prList[pr].head.ref )
          continue
      } 

     if ( conflictHappened ) {
          slack_response=await postSlackMessage(channel, "Branch " + prList[pr].head.ref + " has been updated with latest commit:" + merge_commit_sha + " on train branch. Conflict happened. Need resolution")
          console.log(slack_response)
     } else {
          slack_response=await postSlackMessage(channel, "Branch " + prList[pr].head.ref + " has been updated with latest commit:" + merge_commit_sha + " on train branch. Merge was clean. No conflict")
          console.log(slack_response)
     }

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


def getNewbranchName(branchName) {
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



