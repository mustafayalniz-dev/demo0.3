const fs = require("fs")
const { promisify } = require("util")
const exec = promisify(require("child_process").exec)

const _currentBranch = `git rev-parse --abbrev-ref HEAD`
const _currentTag = `git describe --tags --abbrev=0`
const _lastCommit = `git rev-parse HEAD`

async function main() {

    const { errorB, currentBranch, stderrB } = await exec(`${_currentBranch}`);
    const { errorT, currentTag, stderrT } = await exec(`${_currentBranch}`);
    const { errorC, lastCommit, stderrC } = await exec(`${_currentBranch}`);

    console.log(errorB)
    console.log(currentBranch)
    console.log(stderrB)
    console.log(process.env.BRANCH_NAME)


//    const metadataJson = "../.metadata.json"
//    const metadata = require(metadataJson)

    newMetadataContent = { "branch": currentBranch, "tag": currentTag, "commit": lastCommit }
    let newMetadataContentJson = JSON.stringify(newMetadataContent)


    fs.writeFileSync('.metadata.json', newMetadataContentJson)

    const setEmail = `git config --global user.email "githubaction@goldenheartsgames.com"`
    const setIdentity = `git config --global user.name "GHG Github Action"`
    const addAll = `git add -A`
    const commitAll = `git commit -m "Github Action commits conflict"`
    const pushCurrentBranch = `git push origin ${currentBranch}`


    try {
        const { error, stdout, stderr } = await exec(`${setEmail} && ${setIdentity} ${addAll} && ${commitAll} && ${pushCurrentBranch}`)
        return true
    } catch (error) {
        console.log("Error while commiting metadata:", error)
        return false
    }

}

main()

