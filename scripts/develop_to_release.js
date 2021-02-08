const fetch = require("node-fetch")
const fs = require("fs")

const JIRA_USERNAME = process.env.JIRA_USERNAME
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))


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
 
  var commitsUrls=event.pull_request.commits.href

  console.log("Commits URL: " + commitsUrls)
  
}



