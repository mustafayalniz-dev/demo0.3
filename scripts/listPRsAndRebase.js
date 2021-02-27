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

  var prList = await listPullRequest(trainBranchName)
  
  for ( pr in prList ) {
  	console.log("PR Head : " + prList[pr].head.ref)
	var rebaseResult = rebaseBranchToTrain( prList[pr].head.ref )
        if ( rebaseResult ) {
		console.log("Rebase of " + prList[pr].head.ref + " ended with success")
	} else {
		console.log("Rebase of " + prList[pr].head.ref + " ended with failure")
	}
  }
}

main()

async function rebaseBranchToTrain( prHead ) {

  const fetchTarget = `git fetch`
  const checkoutTarget = `git checkout ${prHead}`
  const pullTarget = `git pull origin ${prHead}`
  const setEmail = `git config --global user.email "githubaction@spin.pm"`
  const setIdentity = `git config --global user.name "Spin Github Action"`
  const rebase = `git rebase ${trainBranchName}`
  const pushHeadBranch = `git push origin ${prHead}`

  try {
      const { error, stdout, stderr } = await exec(`${fetchTarget} && ${checkoutTarget} && ${setEmail} && ${setIdentity} &&  ${rebase} && ${pullTarget} && ${pushHeadBranch}`)
      console.log('stderr:', stderr);
      return true
  } catch (error) {
      console.log("error:", error)
      return false
  }

}

async function listPullRequest(trainBranchName) {

  githubPullRequestUrlWithBase=githubPullRequestUrl + "?base=" + trainBranchName

  const response = await fetch(githubPullRequestUrlWithBase, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
  return await response.json()
}

