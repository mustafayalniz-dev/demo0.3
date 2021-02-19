const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN

//const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
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

  var prList = await listPullRequest(trainBranchName)
  
//  console.log(prList)

  for ( pr in prList ) {
  	console.log("PR Head : " + prList[pr].head.ref)
	rebaseBranchToTrain( prList[pr].head.ref )
  }
}

main()

async function rebaseBranchToTrain( prHead ) {

  const fetchTarget = `git fetch`
  const checkoutTarget = `git checkout ${prHead}`
  const rebase = `git rebase ${trainBranchName}`
  const pushHeadBranch = `git push origin ${prHead}`

  await exec(`${fetchTarget} && ${checkoutTarget} && ${rebase} && ${pushHeadBranch}`)
}

async function listPullRequest(trainBranchName) {

  githubPullRequestUrlWithBase=githubPullRequestUrl + "?base=" + trainBranchName

  const response = await fetch(githubPullRequestUrlWithBase, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
  return await response.json()
}

