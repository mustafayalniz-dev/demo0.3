var child_process = require("child_process")
var compareVersions = require("compare-versions")

const reviewers = "../prmeta.json"
const prMeta = require(reviewers)

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

async function getLastReleaseBranch(array) {
  var releaseBranchRegex = new RegExp("^release_[0-9]+.[0-9]+.[0-9]+$")

  var latestReleaseVersion = "1.0.0"

  array.forEach(function (item) {
    if (!releaseBranchRegex.test(item)) {
      return
    }

    var versionNumberInRemote = item.replace(/release_(\d+\.\d+\.\d+)/, "$1")

    if (compareVersions(latestReleaseVersion, versionNumberInRemote) === -1) {
      latestReleaseVersion = versionNumberInRemote
    }
  })

  const releaseTrainBranch = "release_" + latestReleaseVersion

  return releaseTrainBranch
}

async function main() {
  var array = await getBranchArray()
  var lastReleaseBranch = await getLastReleaseBranch(array)

  var matrixJson = '{' + '"latest_release_branch": "' + lastReleaseBranch + '", "reviewers": "' + prMeta.prReviewers + '", "assignees": "' + prMeta.prAssignees + '" }'

  matrixJson = '{ "include": [' + matrixJson + "] }"


  console.log(matrixJson)
}

main()
