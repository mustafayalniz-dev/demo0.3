var child_process = require("child_process")
var compareVersions = require("compare-versions")

//const GITHUB_REF = process.env.GITHUB_REF
//const currentBranch = GITHUB_REF.replace("refs/heads/", "")

var currentBranch = process.argv.slice(2)[0]

const reviewers = "../prmeta.json"
const prMeta = require(reviewers)

if (currentBranch === "") {
  console.log("You need to give current branch")
  return 1
}

const versionNumber = currentBranch.replace(/release\_(\d+\.\d+\.\d+)/, "$1")

async function getBranchArray() {
  var test = child_process.execSync("git branch --remote -a | grep release")
  var branches = test
    .toString()
    .replace(/remotes\/origin\//g, "")
    .replace(/\s+/g, " ")
    .trim()
  var branchArray = branches.split(" ")

  return branchArray
}

async function getMinorVersionArray(array) {
  var matrixJson = ""

  var releaseBranchRegex = new RegExp("^release_[0-9]+.[0-9]+.[0-9]+$")

  array.forEach(function (item) {
    if (!releaseBranchRegex.test(item)) {
      return
    }
    var versionNumberInRemote = item.replace(/release\_(\d+\.\d+\.\d+)/, "$1")

    if (compareVersions(versionNumber, versionNumberInRemote) === -1) {
      if (matrixJson != "") {
        matrixJson = matrixJson + ","
      }
      matrixJson =
        matrixJson +
        '{ "upstream_release": "' +
        item +
        '", "reviewers": "' +
        prMeta.prReviewers +
        '", "assignees": "' +
        prMeta.prAssignees +
        '"  }'
    }
  })

  matrixJson = '{ "include": [' + matrixJson + "] }"

  return matrixJson
}

async function main() {
  var array = await getBranchArray()
  var matrix = await getMinorVersionArray(array)

  console.log(matrix)
}

main()
