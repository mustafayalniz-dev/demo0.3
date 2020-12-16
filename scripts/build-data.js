var jiraUtils = require("./jira-utils")
const fetch = require("node-fetch")

const webAdminTokenUrl = "https://web.spin.pm/api/v1/auth_tokens"
const webAdminPushUrl = "https://web.spin.pm/api/v1/releases"

async function main() {
  await buildDataFromJiraAndPushToAdmin()
}

main()

async function buildDataFromJiraAndPushToAdmin() {
  var statuses = [
    "Build Ready",
    "Product QA Ready",
    "Product QA In Progress",
    "Product Release Ready",
    "Product QA Blocked",
    "Released",
  ]

  const issues = await getJiraTickets(statuses)
  const linkedIssues = await getLinkedIssues(statuses)
  var allIssues = await issues.concat(linkedIssues)
  const releaseUrl = await getReleaseUrl()

  const payload = {
    release_name: jiraUtils.releaseName(),
    release_url: releaseUrl,
    build_group_name:
      process.env.BITRISE_GIT_TAG ||
      process.env.BITRISE_GIT_COMMIT ||
      process.env.BITRISE_GIT_MESSAGE,
    build_group_tickets: allIssues,
    mobile_build_name: process.env.BITRISE_BUILD_NUMBER,
    mobile_build_type: process.env.BITRISE_TRIGGERED_WORKFLOW_TITLE,
    mobile_build_url: process.env.BITRISE_PUBLIC_INSTALL_PAGE_URL,
  }

  console.log(payload)

  const token_response = await getJWT()
  const { jwt } = await token_response.json()
  const adminPostResult = await postPayloadToAdmin(jwt, payload)
  console.log(adminPostResult)
  var statusesBR = ["Build Ready"]

  const issuesBR = await getJiraTickets(statusesBR)
  const linkedIssuesBR = await getLinkedIssues(statusesBR)
  const buildReadyIssues = await issuesBR.concat(linkedIssuesBR)

  await transitionIssues(buildReadyIssues)
}

async function transitionIssues(issues) {
  issues.forEach(async function (issue, index) {
    const issue_id = issue.replace(/https:\/\/spinbikes.atlassian.net\/browse\//, "")
    const eNoQA = await jiraUtils.isEngineeringNoQA(issue_id)

    if (eNoQA) {
      console.log("Transitioning " + index + " ticket " + issue_id + " to ReleaseReady")
      await jiraUtils.transitionRequest(issue_id, jiraUtils.jiraTransitionIdProductReleaseReady)
    } else {
      console.log("Transitioning " + index + " ticket " + issue_id + " to ReadyForQA")
      await jiraUtils.transitionRequest(issue_id, jiraUtils.jiraTransitionIdReadyForQA)
    }
  })
}

async function getJiraTickets(statuses) {
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

async function getReleaseUrl() {
  const releaseInfo = await jiraUtils.getReleaseURL()

  var index = releaseInfo.findIndex((info) => info.name === jiraUtils.releaseName())

  var releaseInformation = releaseInfo[index].self.replace(
    /^https:\/\/spinbikes.atlassian.net\/rest\/api\/3\/version\//,
    ""
  )
  releaseInformation =
    "https://spinbikes.atlassian.net/projects/" +
    jiraUtils.projectId +
    "/versions/" +
    releaseInformation +
    "/tab/release-report-all-issues"
  return releaseInformation
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

async function getJWT() {
  const headersToSend = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Cookie: "null",
    "api-version": "1.1",
  }

  const requestBody = {
    userUniqueKey: process.env.ADMIN_USER_UNIQUE_KEY,
    refreshToken: process.env.ADMIN_USER_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }

  return await fetch(webAdminTokenUrl, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: headersToSend,
  })
}

async function postPayloadToAdmin(jwt, requestBody) {
  const headersToSend = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Cookie: "null",
    "api-version": "1.1",
    Authorization: `Bearer: ${jwt}`,
  }

  return await fetch(webAdminPushUrl, {
    method: "post",
    body: JSON.stringify(requestBody),
    headers: headersToSend,
  })
}
