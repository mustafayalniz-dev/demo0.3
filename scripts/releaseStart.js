const fetch = require("node-fetch")
const { promisify } = require("util")
const fs = require("fs")
const exec = promisify(require("child_process").exec)

const SLACK_TOKEN = process.env.SLACK_TOKEN
const channel = "github-actiontest"

const PUSH_GITHUB_USER = process.env.PUSH_GITHUB_USER
const PERSONAL_ACCESS_TOKEN = process.env.PERSONAL_ACCESS_TOKEN
const CREATE_BRANCH_TOKEN = process.env.CREATE_BRANCH_TOKEN


async function main() {
	await releaseStart()
}
main()

async function releaseStart() {
      
      await exec(`${fetchTarget} && ${checkoutMaster})

      const release = "../.release-version.json"
      const releaseVersion = require(release)

      console.log(releaseVersion.version)

      let major = parseInt(releaseVersion.version.replace(/(\d+)\.(\d+)\.(\d+)/, "$1"))
      let minor = parseInt(releaseVersion.version.replace(/(\d+)\.(\d+)\.(\d+)/, "$2"))
      let patch = parseInt(releaseVersion.version.replace(/(\d+)\.(\d+)\.(\d+)/, "$3"))

      minor=minor+1

      newVersion=major + "." + minor + "." + patch
      newIntegrationBranch="integration_" + newVersion

      console.log(newIntegrationBranch)

      const fetchTarget = `git fetch`
      const checkoutMaster = `git checkout master`
      const addVersionFile = `git add .release-version.json`
      const commitVersionFile = `git commit -m "bumped application version to ${newVersion}"`
      const pushVersionFile = `git push origin master`
      const setEmail = `git config --global user.email "githubaction@spin.pm"`
      const setIdentity = `git config --global user.name "Spin Github Action"`
      const createNewIntegrationBranch = `git checkout -b ${newIntegrationBranch}`
      const pushNewIntegrationBranch = `git push origin ${newIntegrationBranch}`

      newReleaseContent = { "version": newVersion }

      let newReleaseContentJson = JSON.stringify(newReleaseContent)
      fs.writeFileSync('.release-version.json', newReleaseContentJson)

      var success=false
      try {
          const { error, stdout, stderr } = await exec(`${fetchTarget} && ${checkoutMaster} &&  ${addVersionFile} &&${setEmail} && ${setIdentity} && ${commitVersionFile} &&  ${pushVersionFile} && ${createNewIntegrationBranch} && ${pushNewIntegrationBranch}`)
          console.log('stdout:', stdout);
          console.log('stderr:', stderr);
          success=true
      } catch (error) {
          console.log("error:", error)
          success=false
      }

      if ( success ) {
          
      }
      return success
}






