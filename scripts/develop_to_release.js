const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)

const JIRA_USERNAME = process.env.JIRA_USERNAME
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN
const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.MY_PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
const branchHeadsUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs/heads/"
const newBranchUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs"

const githubAuth =
  "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")
const githubPullRequestUrl = "https://api.github.com/repos/spin-org/spin-mobile/pulls"

async function main() {

  await createBranchAndApplyCommits()

}

main()

async function cleanCherryPick(fetchTarget, checkoutTarget, cherryPick, pushTargetBranch) {
  await exec(`${fetchTarget} && ${checkoutTarget} && ${cherryPick} && ${pushTargetBranch}`)
}

async function commitConflict(addAll, commitAll, pushTargetBranch) {
  await exec(`${addAll} && ${commitAll} && ${pushTargetBranch}`)
}

async function headersWithAuthGithub(headers) {
  const auth = "token " + CREATE_BRANCH_TOKEN
  return Object.assign(headers, { Authorization: auth })
}

async function createBranchAndApplyCommits() {

  let newBranchName = Math.random().toString(36).substring(7);
 
  var commitsUrl=event.pull_request.commits_url
  var merge_commit_sha=event.pull_request.merge_commit_sha

  console.log("Merge commit sha : " + merge_commit_sha)
  console.log(commitsUrl)

  commits = await getCommitsFromUrl(commitsUrl)
  
  sourceBranchSha=await getBranchSha("release_branch")
   
  console.log(sourceBranchSha)
  newBranchResponse = await createNewBranch(sourceBranchSha, "release_branch_" + newBranchName)

  console.log("release_branch_" +newBranchName)
  console.log(newBranchResponse)

  const fetchTarget = `git fetch`
  const checkoutTarget = `git checkout release_branch_${newBranchName}`
  const cherryPick = `git cherry-pick -m 1 ${merge_commit_sha}` // the `-m 1` part is because we're cherry-picking a merge commit and we have to specify if "1" or "2" is the base parent. i know, it's weird: https://git-scm.com/docs/git-cherry-pick#Documentation/git-cherry-pick.txt--mparent-number
  const pushTargetBranch = `git push origin release_branch_${newBranchName}`
  const addAll = `git add *`
  const commitAll = `git commit -m "committing conflicts"`

  console.log("Executing cherry pick")

//  await exec(`${fetchTarget} && ${checkoutTarget} && ${cherryPick} && ${pushTargetBranch}`, (error, stdout, stderr) => {
//  if (error) {
//    console.error(`exec error: ${error}`);
//    return;
//  }
//  console.log(`stdout: ${stdout}`);
//  console.error(`stderr: ${stderr}`);
//  })

  try {
    cleanCherryPick(fetchTarget, checkoutTarget, cherryPick, pushTargetBranch)
  } catch (e) {
    console.log("e:", e)
    if (e.message.includes("conflicts")) {
      console.log("conflict occured pushing conflict ")
      commitConflict(addAll, commitAll, pushTargetBranch)
    }
  }


 
  console.log("Cherry pick complete")
}

async function createNewBranch(sourceBranchSha, newBranchName) {

  const requestBody = {
    "ref": "refs/heads/" + newBranchName,
    "sha": sourceBranchSha
  }
  console.log(requestBody)

  var headers = await headersWithAuthGithub({ "Accept": "application/vnd.github.v3+json" })

  console.log(headers)

  const response = await fetch(newBranchUrl, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: headers,
  })
  return await response.json()

}


async function getBranchSha(sourceBranch) {
  branchHeadsUrlOfBranch=branchHeadsUrl + sourceBranch
  const response = await fetch(branchHeadsUrlOfBranch, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
 
  headsContent=await response.json()

  var shaBranch=""
  
  shaBranch = headsContent.object.sha

  return shaBranch

//  return await response.json()

}

async function getCommitsFromUrl(commitsUrl) {

  const response = await fetch(commitsUrl, {
    method: "get",
    headers: { Authorization: githubAuth },
  })

  commitsContent=await response.json()

  let commitShas = []

  for ( key in commitsContent) {
	commitShas.push(commitsContent[key].sha)
  }
  console.log("Printing commits shas")
  console.log(commitShas)

  return commitShas

}

async function createPullRequest() {
  const requestBody = {
    title: `Pulling "${prTitle}" into ${targetBranchName}`,
    head: conflictBranchName,
    base: targetBranchName,
    body: `Automated PR to keep ${targetBranchName} up to date. Please resolve conflicts before merging!`,
  }
  const response = await fetch(githubPullRequestUrl, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: { Authorization: githubAuth },
  })
  return await response.json()
}


