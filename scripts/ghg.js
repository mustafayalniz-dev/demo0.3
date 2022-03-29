const fs = require("fs")
const { promisify } = require("util")
const exec = promisify(require("child_process").exec)

const _currentBranch = `git rev-parse --abbrev-ref HEAD`
const _currentTag = `git describe --tags --abbrev=0`
const _lastCommit = `git rev-parse HEAD`

async function main() {

    const { currentBranch, stderrB } = await exec(`${_currentBranch}`);
    const { currentTag, stderrT } = await exec(`${_currentBranch}`);
    const { lastCommit, stderrC } = await exec(`${_currentBranch}`);


    const metadataJson = "../.metadata.json"
    const metadata = require(metadataJson)

    newMetadataContent = { "branch": currentBranch, "tag": currentTag, "commit": lastCommit }
    let newMetadataContentJson = JSON.stringify(newMetadataContent)


    fs.writeFileSync('.metadata.json', newMetadataContentJson)

}

main()

