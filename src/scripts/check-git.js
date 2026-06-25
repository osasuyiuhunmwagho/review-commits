// this is a throwaway harness for getCommits. Not part of the shipped CLI.
// Run from the project root: node scripts/check-git.js [repoPath] [limit]
import { getCommits } from "../git.js";

const repoPath = process.argv[2] || process.cwd();
const limit = process.argv[3] || 5;

const commits = await getCommits(repoPath, limit);

console.log(`Got ${commits.length} commit(s) from ${repoPath}\n`);
for (const c of commits) {
  console.log("hash:     ", c.hash);
  console.log("shortHash:", c.shortHash);
  console.log("author:   ", c.author);
  console.log("date:     ", c.date);
  console.log("subject:  ", c.subject);
  console.log("body:     ", JSON.stringify(c.body));
  console.log("message:  ", JSON.stringify(c.message));
  console.log("stat:     ", c.stat);
  console.log("");
}