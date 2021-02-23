const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
const branchHeadsUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs/heads/"
const newBranchUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs"

const githubAuth =
  "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")
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

async function cleanCherryPick(setEmail, setIdentity, fetchTarget, checkoutTarget, cherryPick, pushTargetBranch) {
  await exec(`${fetchTarget} && ${checkoutTarget} && ${setEmail} && ${setIdentity} && ${cherryPick} && ${pushTargetBranch}`)
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

async function headersWithAuthGithub(headers) {
  const auth = "token " + CREATE_BRANCH_TOKEN
  return Object.assign(headers, { Authorization: auth })
}

async function createBranchAndApplyCommits() {

  let newBranchNameSuffix = Math.random().toString(36).substring(7);
 
  var merge_commit_sha=event.pull_request.merge_commit_sha
  
  sourceBranchSha=await getSourceBranchSha(trainBranchName)
  
  newBranchFromReleaseBranch=trainBranchName + "_" + newBranchNameSuffix 
  newBranchResponse = await createNewBranch(sourceBranchSha, newBranchFromReleaseBranch)

  console.log("New branch response: ")
  if ( newBranchResponse["ref"] ) {
     console.log(newBranchResponse)
  } else {
     console.log("New branch from " + trainBranchName + " failed. Exiting...")
     return 
  }

  const fetchTarget = `git fetch`
  const checkoutTarget = `git checkout ${newBranchFromReleaseBranch}`
  const cherryPick = `git cherry-pick -m 1 ${merge_commit_sha}`
  const pushTargetBranch = `git push origin ${newBranchFromReleaseBranch}`

  const setEmail = `git config --global user.email "githubaction@spin.pm"`
  const setIdentity = `git config --global user.name "Spin Github Action"`
  const addAll = `git add -A`
  const commitAll = `git commit -m "Github Action commits conflict"`

  var cherryPickSuccess=false

  try {
    const { error, stdout, stderr } = await cleanCherryPick(setEmail, setIdentity, fetchTarget, checkoutTarget, cherryPick, pushTargetBranch)
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
    cherryPickSuccess=true
  } catch (error) {
    console.log("error:", error)
    if (error.message.includes("conflicts")) {
      console.log("Conflict occured while cherry picking, now pushing conflict into new branch...")
      cherryPickSuccess=await commitConflict(setEmail, setIdentity, addAll, commitAll, pushTargetBranch)
    }
  }

  if ( cherryPickSuccess ) {
     console.log("Proceeding to PR")
     var originPRTitle=event.pull_request.title
     targetBranchName=newBranchFromReleaseBranch
     pr_result=await createPullRequest(trainBranchName, targetBranchName, originPRTitle)
     console.log(pr_result)
  } else {
     console.log("As cherry pick or conflict push not succeeded, PR creation cancelled...")
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

async function createPullRequest(backBranchName, newSourceBranchName, originPRTitle) {
  console.log("We PR from " + newSourceBranchName + " " + backBranchName + " " + originPRTitle)

  const requestBody = {
    title: `Pulling "${originPRTitle}" from ${newSourceBranchName} into ${backBranchName}`,
    head: newSourceBranchName,
    base: backBranchName,
    body: `Automated PR to get changes over to ${backBranchName}. Please resolve conflicts before merging!`,
  }
  const response = await fetch(githubPullRequestUrl, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: { Authorization: githubAuth },
  })
  return await response.json()
}

