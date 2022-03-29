const fs = require("fs")
const { promisify } = require("util")
const exec = promisify(require("child_process").exec)

async function main() {

    const currentBranch = process.env.BRANCH_NAME
    const currentTag = process.env.RELEASE_VERSION
    const lastCommit = process.env.COMMIT

//    const metadataJson = "../.metadata.json"
//    const metadata = require(metadataJson)

    newMetadataContent = { "branch": currentBranch, "tag": currentTag, "commit": lastCommit }
    let newMetadataContentJson = JSON.stringify(newMetadataContent)


    fs.writeFileSync('.metadata.json', newMetadataContentJson)

    const setEmail = `git config --global user.email "githubaction@goldenheartsgames.com"`
    const setIdentity = `git config --global user.name "GHG Github Action"`
    const addAll = `git add .metadata.json`
    const commitAll = `git commit -m "Github Action commits conflict"`
    const pushCurrentBranch = `git push origin ${currentBranch}`


    try {
        const { error, stdout, stderr } = await exec(`${setEmail} && ${setIdentity} && ${addAll} && ${commitAll} && ${pushCurrentBranch}`)
        return true
    } catch (error) {
        console.log("Error while commiting metadata:", error)
        return false
    }

}

main()

