var jiraUtils = require("./jira-utils")
const util = require("util")
const exec = util.promisify(require("child_process").exec)
const fetch = require("node-fetch")

const JIRA_USERNAME = process.env.JIRA_USERNAME
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN
const getJiraVersions = "https://spinbikes.atlassian.net/rest/api/2/project/RDE/versions"

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const githubReleasesUrl = "https://api.github.com/repos/spin-org/spin-mobile/releases"

const GITHUB_REF = process.env.GITHUB_REF
const branchName = GITHUB_REF.replace("refs/heads/", "")
const releasingVersion = branchName.replace("release_", "")

async function main() {
  await mergeIntoMaster()
  await createGitHubVersion()
  await transitionAllIssues()
}
main()

async function executeWithLogs(command) {
  try {
    const { stdout, stderr } = await exec(command)
    console.log("stdout:", stdout)
    console.error("stderr:", stderr)
  } catch (err) {
    console.error(err)
  }
}

async function mergeIntoMaster() {
  await executeWithLogs(
    `git fetch origin && git checkout master && git pull origin master --allow-unrelated-histories && git checkout ${branchName} && git pull origin ${branchName} --allow-unrelated-histories && git merge -s ours master --allow-unrelated-histories && git checkout master && git merge ${branchName} && git push origin master`
  )
}

async function getJiraReleasePage() {
  const jiraAuth =
    "Basic " + global.Buffer.from(JIRA_USERNAME + ":" + JIRA_API_TOKEN).toString("base64")
  const versionsResponse = await fetch(`${getJiraVersions}`, {
    headers: { Authorization: jiraAuth, "Content-Type": "application/json" },
  })
  const versions = await versionsResponse.json()
  const jiraVersion = versions.find((version) => version.name.includes(releasingVersion))
  return `https://spinbikes.atlassian.net/projects/RDE/versions/${jiraVersion.id}/tab/release-report-all-issues`
}

async function createGitHubVersion() {
  const jiraReleasePage = await getJiraReleasePage()

  const githubAuth =
    "Basic " + global.Buffer.from(PUSH_GITHUB_USER + ":" + PERSONAL_ACCESS_TOKEN).toString("base64")

  const requestBody = {
    tag_name: releasingVersion,
    name: releasingVersion,
    target_commitish: "master",
    body: jiraReleasePage,
  }
  return await fetch(githubReleasesUrl, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: { Authorization: githubAuth },
  })
}

// ISSUE TRANSITIONS

async function transitionAllIssues() {
  var statuses = ["Product Release Ready"]
  const issues = await getJiraTickets(statuses)

  const linkedIssues = await getLinkedIssues(statuses)
  var allIssues = await issues.concat(linkedIssues)

  console.log("Listing all issues")
  console.log(allIssues)
  await transitionIssuesAsReleased(allIssues)
}

async function transitionIssuesAsReleased(issues) {
  issues.forEach(async function (issue, index) {
    var issue_id = issue.replace(/https:\/\/spinbikes.atlassian.net\/browse\//, "")
    var isReleaseReady = await jiraUtils.isReleaseReady(issue_id)

    console.log(issue_id + isReleaseReady)
    if (isReleaseReady) {
      console.log("Transitioning " + index + " ticket " + issue_id + " to Released")
      await jiraUtils.transitionRequest(issue_id, jiraUtils.jiraTransitionIdReleased)
    }
  })
}

async function getJiraTickets(statuses) {
//  await jiraUtils.loadJiraCredentials()
  const ticketsRDE = await jiraUtils.listForTicketsForProject(jiraUtils.projectName)

  var issueURLList = []

  for (var key in ticketsRDE.issues) {
    if (statuses.includes(ticketsRDE.issues[key].fields.status.name)) {
      var issueURL = jiraUtils.baseUrl + jiraUtils.browseUrl + ticketsRDE.issues[key].key
      issueURLList.push(issueURL)
    }
  }
  return issueURLList
}

async function getLinkedIssues(statuses) {
  const linkedIssueList = await jiraUtils.listLinkedIssuesForProjectVersionWrappedByLabel(statuses)
  var linkedIssueURLList = []
  for (var key in linkedIssueList) {
    var issueURL = jiraUtils.baseUrl + jiraUtils.browseUrl + linkedIssueList[key]
    linkedIssueURLList.push(issueURL)
  }
  return linkedIssueURLList
}
