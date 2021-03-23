const fetch = require("node-fetch")
const inquirer = require("inquirer")

module.exports = {
  projectName: "Rider Experience",
  projectId: "RDE",

  baseUrl: "https://spinbikes.atlassian.net",
  jqlSearchBaseUrl: "/rest/api/2/search/?jql=",
  issueBaseUrl: "/rest/api/2/issue/",
  transitionUrl: "/transitions",
  browseUrl: "/browse/",

  headersWithAuth: function (headers) {
    const auth =
      "Basic " +
      global.Buffer.from(process.env.JIRA_USERNAME + ":" + process.env.JIRA_API_TOKEN).toString(
        "base64"
      )
    return Object.assign(headers, { Authorization: auth })
  },

  transitionRequest: async function (ticket, transitionId) {
    const requestBody = { transition: { id: transitionId } }
    const transitionStatus = await fetch(
      `${this.baseUrl}${this.issueBaseUrl}${ticket}${this.transitionUrl}`,
      {
        method: "post",
        body: JSON.stringify(requestBody),
        headers: this.headersWithAuth({ "Content-Type": "application/json" }),
      }
    )

    return transitionStatus
  },

  createJiraIssueForConflict: async function (projectKey, reporter, issueType, conflictMessage) {

    reporter="5f7784e5e31b69006fa1159d"
    const requestBody = {
       'fields': {
            'project': {
              'key': 'RDE'
            },
            'summary': 'There is a conflict : ' + conflictMessage,
            'description': 'Urgent Action is required to fix conflict' + conflictMessage,
            'issuetype': {
              'name': "Bug"
            }
       }
    } 

    console.log(JSON.stringify(requestBody))
    const issueCreateStatus = await fetch(
      `${this.baseUrl}${this.issueBaseUrl}`,
      {
        method: "post",
        body: JSON.stringify(requestBody),
        headers: this.headersWithAuth({ "Content-Type": "application/json" }),
      }
    )

    return issueCreateStatus
  },

  logResponse: async function (ticket, response) {
    if (response.ok) {
      console.log(
        `${this.LogColorGreen}%s${this.LogColorReset}`,
        `${ticket} successfully transitioned`
      )
    } else {
      const json = await response.json()
      console.log(`${this.LogColorRed}%s${this.LogColorReset}`, `${ticket} failed with response:`)
      console.log(json)
    }
  },

}
