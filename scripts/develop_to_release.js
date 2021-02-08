const fetch = require("node-fetch")
const fs = require("fs")

const JIRA_USERNAME = process.env.JIRA_USERNAME
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN
const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.MY_PERSONAL_ACCESS_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
const branchHeadsUrl="https://api.github.com/repos/mustafayalniz-dev/demo0.3/git/refs"

const githubAuth =
  "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")
const githubPullRequestUrl = "https://api.github.com/repos/spin-org/spin-mobile/pulls"

async function main() {
  await processCommits()

}

main()

async function headersWithAuth(headers) {
  const auth =
    "Basic " + global.Buffer.from(JIRA_USERNAME + ":" + JIRA_API_TOKEN).toString("base64")
  return Object.assign(headers, { Authorization: auth })
}

async function processCommits() {
 
  var commitsUrls=event.pull_request.commits_url

  console.log(commitsUrls)
  
  getBranchSha("master")
}

async function getBranchSha(sourceBranch) {
  const response = await fetch(branchHeadsUrl, {
    method: "get",
    headers: { Authorization: githubAuth },
  })
 
  headsContent=await response.json()

  console.log("Now looping")
  console.log(headsContent)
  var headsArr=[]
  try {
  	headsArr = JSON.parse(headsContent);
  } catch (e) {
	headsArr = []
  }
  for(var i = 0; i < headsArr.length; i++)
  {
    console.log(headArr[i].ref)
    console.log("Looping now")
    if ( headArr[i].ref == "refs/heads/master" ) {
             console.log("Setting shaBranch ")
             shaBranch=headArr[i].object.sha
     }

  }

  console.log(shaBranch)

//  return await response.json()

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


