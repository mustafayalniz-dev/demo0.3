const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)

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

async function commitConflict(setEmail, setIdentity, addAll, commitAll, pushTargetBranch) {
  await exec(`${setEmail} && ${setIdentity} &&  ${addAll} && ${commitAll} && ${pushTargetBranch}`)
}

async function headersWithAuthGithub(headers) {
  const auth = "token " + CREATE_BRANCH_TOKEN
  return Object.assign(headers, { Authorization: auth })
}

async function createBranchAndApplyCommits() {

  let newBranchNameSuffix = Math.random().toString(36).substring(7);
 
  var merge_commit_sha=event.pull_request.merge_commit_sha
  var origin_pr_title=event.pull_request.title

  console.log("PR Title ")
  console.log(origin_pr_title)
  
  sourceBranchSha=await getSourceBranchSha("release_branch")
  
  newBranchFromReleaseBranch="release_branch_" + newBranchNameSuffix 
  newBranchResponse = await createNewBranch(sourceBranchSha, newBranchFromReleaseBranch)

  const fetchTarget = `git fetch`
  const checkoutTarget = `git checkout release_branch_${newBranchNameSuffix}`
  const cherryPick = `git cherry-pick -m 1 ${merge_commit_sha}`
  const pushTargetBranch = `git push origin ${newBranchFromReleaseBranch}`
  const addAll = `git add -A`
  const commitAll = `git commit -m "Github Action commits conflict"`
  const setEmail = `git config --global user.email "githubaction@spin.pm"`
  const setIdentity = `git config --global user.name "Spin Github Action"`

  try {
    const { error, stdout, stderr } = await cleanCherryPick(fetchTarget, checkoutTarget, cherryPick, pushTargetBranch)
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
  } catch (error) {
    console.log("error:", error)
    if (error.message.includes("conflicts")) {
      console.log("conflict occured pushing conflict ")
      await commitConflict(setEmail, setIdentity, addAll, commitAll, pushTargetBranch)
    }
  }

}

async function createNewBranch(sourceBranchSha, newBranchFromReleaseBranch) {

  const requestBody = {
    "ref": "refs/heads/" + newBranchFromReleaseBranch,
    "sha": sourceBranchSha
  }

  var headers = await headersWithAuthGithub({ "Accept": "application/vnd.github.v3+json" })

  const response = await fetch(newBranchUrl, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: headers,
  })

  return await response.json()

}


async function getSourceBranchSha(sourceBranch) {
  branchHeadsUrlOfBranch=branchHeadsUrl + sourceBranch
  const response = await fetch(branchHeadsUrlOfBranch, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
 
  headsContent=await response.json()
  
  shaBranch = headsContent.object.sha

  return shaBranch

}

async function createPullRequest(sourceBranchName, targetBranchName) {
  const requestBody = {
    title: `Pulling "${prTitle}" into ${targetBranchName}`,
    head: sourceBranchName,
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


