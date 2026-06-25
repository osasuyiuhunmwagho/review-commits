import { reviewCommit } from "../reviewer.js";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Set OPENROUTER_API_KEY first.");
  process.exit(1);
}

// a deliberately lazy message so the rating is interesting
const commit = { message: "fix stuff" };

const result = await reviewCommit(commit, { apiKey });
console.log("PARSED RESULT:", result);