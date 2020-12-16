const reviewers = "../prmeta.json"
const prMeta = require(reviewers)

var users = process.argv.slice(2)[0]

if ( users === "reviewers" ) {
	console.log(prMeta.prReviewers)
} else if ( users === "assignees" ) {
	console.log(prMeta.prAssignees)
}
