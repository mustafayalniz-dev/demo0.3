const fetch = require("node-fetch")
const inquirer = require("inquirer")

module.exports = {
  projectName: "Rider Experience",
  projectId: "RDE",
  growthLabel: "GrowthTicketsForRelease",
  paymentLabel: "PaymentTicketsForRelease",
  engineeringNoQALabel: "EngineeringNoQA",

  baseUrl: "https://spinbikes.atlassian.net",
  jqlSearchBaseUrl: "/rest/api/2/search/?jql=",
  issueBaseUrl: "/rest/api/2/issue/",
  transitionUrl: "/transitions",
  browseUrl: "/browse/",

  jiraTransitionIdBuildReady: 231,
  jiraTransitionIdProductReleaseReady: 23,
  jiraTransitionIdReadyForQA: 341,
  jiraTransitionIdEngApproved: 321,
  jiraTransitionIdReadyForQAPAY: 0, // TODO: convert PAY to standard workflow
  jiraTransitionIdEngApprovedPAY: 141, // TODO: convert PAY to standard workflow
  jiraTransitionIdReleased: 331,
  jiraTransitionIdReleasedPAY: 181, // TODO: convert PAY to standard workflow

  LogColorReset: "\x1b[0m",
  LogColorRed: "\x1b[31m",
  LogColorGreen: "\x1b[32m",

  askForConfirmation: async function () {
    const output = await inquirer.prompt([
      {
        type: "confirm",
        name: "answer",
        message: "Are you sure?",
      },
    ])

    return output.answer
  },

  releaseName: function () {
    const packagePath = "../package.json"
    const packageInfo = require(packagePath)
    return `Rider App ${packageInfo.version}`
  },

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

  searchForTicketsForProject: async function () {
    const jqlSearch = encodeURIComponent(
      `project = "${this.projectName}" AND fixVersion = "${this.releaseName()}"`
    )
    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()
    return await this.appendTicketsInsideEpics(searchResponseJson.issues || [])
  },

  listForTicketsForProject: async function () {
    const jqlSearch = encodeURIComponent(
      `project = "${this.projectName}" AND fixVersion = "${this.releaseName()}"`
    )
    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()

    return searchResponseJson
  },

  getReleaseURL: async function () {
    const releaseUrlResponse = await fetch(
      `${this.baseUrl}/rest/api/3/project/${this.projectId}/versions`,
      {
        headers: this.headersWithAuth({}),
      }
    )
    const releaseUrlResponseJson = await releaseUrlResponse.json()
    return releaseUrlResponseJson
  },

  isEngineeringNoQA: async function (issue_id) {
    const jqlSearch = encodeURIComponent(
      `issueKey="${issue_id}" AND labels in ( "${this.engineeringNoQALabel}" )`
    )

    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()

    if (Object.keys(searchResponseJson.issues).length > 0) {
      return true
    }

    return false
  },

  isInStatuses: async function (issue_id, statuses) {
    const statusesQuoted = statuses.map((status) => '"' + status + '"')

    var stringStatuses = statusesQuoted.join(",")

    const jqlSearch = encodeURIComponent(
      `issueKey="${issue_id}" AND status in ( ${stringStatuses} )`
    )

    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()

    if (Object.keys(searchResponseJson.issues).length > 0) {
      return true
    }

    return false
  },

  isInReview: async function (issue_id) {
    const jqlSearch = encodeURIComponent(`issueKey="${issue_id}" AND status="In Review"`)

    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()

    if (Object.keys(searchResponseJson.issues).length > 0) {
      return true
    }

    return false
  },

  isReleaseReady: async function (issue_id) {
    const jqlSearch = encodeURIComponent(
      `issueKey="${issue_id}" AND status="Product Release Ready" `
    )

    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()

    if (searchResponseJson.issues === undefined) {
      return false
    }
    if (Object.keys(searchResponseJson.issues).length > 0) {
      return true
    }

    return false
  },

  listLinkedIssuesForProjectVersionWrappedByLabel: async function (statuses) {
    const jqlSearch = encodeURIComponent(
      `project = "${this.projectName}" AND fixVersion = "${this.releaseName()}" AND labels in ( "${
        this.growthLabel
      }", "${this.paymentLabel}" )`
    )
    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()

    let linkedIssues = []

    for (var issue in searchResponseJson.issues) {
      //      if (!statuses.includes(searchResponseJson.issues[issue].fields.status.name)) {
      //        continue
      //      }

      if ("issuelinks" in searchResponseJson.issues[issue].fields) {
        // if tickets aren't linked as blockers to the wrapper, this won't touch them
        const linksToTicketsThatBlockWrapper = searchResponseJson.issues[
          issue
        ].fields.issuelinks.filter((link) => link.type.inward === "is blocked by")
        for (var link in linksToTicketsThatBlockWrapper) {
          if (linksToTicketsThatBlockWrapper[link].inwardIssue !== undefined) {
            const lissue = linksToTicketsThatBlockWrapper[link].inwardIssue.key
            const lissue_id = lissue.replace(/https:\/\/spinbikes.atlassian.net\/browse\//, "")
            const lissueStatusOk = await this.isInStatuses(lissue_id, statuses)
            console.log(lissue_id + ": " + lissueStatusOk)
            if (lissue !== "undefined") {
              linkedIssues.push(lissue)
            }
          }
        }
      }
    }
    return linkedIssues
  },

  searchForTicketsWrappedByLabel: async function (label) {
    const jqlSearch = encodeURIComponent(
      `project = "${
        this.projectName
      }" AND fixVersion = "${this.releaseName()}" AND labels = "${label}"`
    )
    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()
    if (searchResponseJson.issues && searchResponseJson.issues[0]) {
      // if tickets aren't linked as blockers to the wrapper, this won't touch them
      const linksToTicketsThatBlockWrapper = searchResponseJson.issues[0].fields.issuelinks.filter(
        (link) => link.type.inward === "is blocked by"
      )
      const ticketsThatBlockWrapper = linksToTicketsThatBlockWrapper.map((link) => link.inwardIssue)
      return await this.appendTicketsInsideEpics(ticketsThatBlockWrapper)
    } else {
      return []
    }
  },

  appendTicketsInsideEpics: async function (issues) {
    let appendedIssues = issues
    await Promise.all(
      issues.map(async (issue) => {
        if (issue.fields && issue.fields.issuetype && issue.fields.issuetype.name === "Epic") {
          const key = issue.key
          const issuesInEpic = await this.searchForTicketsWithinEpic(key)
          Array.prototype.push.apply(appendedIssues, issuesInEpic)
        }
      })
    )
    return appendedIssues
  },

  searchForTicketsWithinEpic: async function (epic) {
    const jqlSearch = encodeURIComponent(`"Epic Link" = ${epic}`)
    const jqlSearchUrl = this.jqlSearchBaseUrl + jqlSearch
    const searchResponse = await fetch(`${this.baseUrl}${jqlSearchUrl}`, {
      headers: this.headersWithAuth({}),
    })
    const searchResponseJson = await searchResponse.json()
    return searchResponseJson.issues
  },
}
