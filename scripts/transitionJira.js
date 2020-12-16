var jiraUtils = require("./jira-utils")
const fetch = require("node-fetch")
const fs = require("fs")

const JIRA_USERNAME = process.env.JIRA_USERNAME
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))

const baseUrl = "https://spinbikes.atlassian.net"
const issueBaseUrl = "/rest/api/2/issue/"

const issueCommentBaseUrl = "/rest/api/3/issue/"

var issueKeyRegex = /^\[[A-Z]+-[0-9]+[^\]]+\].+$/

async function getIssueKeys() {
 	var issueKeys = event.pull_request.title.replace(/^\[([A-Z]+-[0-9]+[^\]]+)\].+$/, "$1")
	var issueKeysArray = issueKeys.split(",")

	var issueKeysTrimmed = []

	issueKeysArray.forEach(async function (item) {
		await issueKeysTrimmed.push(item.trim())
  	})

	console.log(issueKeysTrimmed)
  	return issueKeysTrimmed
}

async function transitionIssues( issueKeys ) {
	issueKeys.forEach( async (issue_id, index ) => {
		var isInReview = false
		try {
    			isInReview = await jiraUtils.isInReview(issue_id)
		} catch(err) {
			console.log(err)
		}
    		if (isInReview) {
      			console.log("Transitioning " + index + "th ticket " + issue_id + " to BuildReady")
      			await jiraUtils.transitionRequest(issue_id, jiraUtils.jiraTransitionIdBuildReady)
    		}

	})
}

async function main() {
	var issueKeys = []
	if (issueKeyRegex.test(event.pull_request.title)) {
		issueKeys = await getIssueKeys()
		await transitionIssues(issueKeys)
	}
}

main()


