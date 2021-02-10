const fetch = require("node-fetch")
const fs = require("fs")

const JIRA_USERNAME = process.env.JIRA_USERNAME
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN
const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.MY_PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
const branchHeadsUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs"
const newBranchUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs"

const githubAuth =
  "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")
const githubPullRequestUrl = "https://api.github.com/repos/spin-org/spin-mobile/pulls"

async function main() {
  await createBranchAndApplyCommits()

}

main()

async function headersWithAuthGithub(headers) {
  const auth = "token " + CREATE_BRANCH_TOKEN
  return Object.assign(headers, { Authorization: auth })
}

async function createBranchAndApplyCommits() {

  let newBranchName = Math.random().toString(36).substring(7);
 
  var commitsUrl=event.pull_request.commits_url

  console.log(commitsUrl)

  commits = await getCommitsFromUrl(commitsUrl)
  
  sourceBranchSha=await getBranchSha("develop")
   
  newBranchResponse = await createNewBranch(sourceBranchSha, newBranchName)

  console.log(newBranchName)
  console.log(newBranchResponse)
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
  const response = await fetch(branchHeadsUrl, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
 
  headsContent=await response.json()

  var shaBranch=""

  for (key in headsContent) {
    if ( headsContent[key].ref == "refs/heads/" + sourceBranch) {
	shaBranch = headsContent[key].object.sha
    }
  };

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


