// Parses CLI arguments and orchestrates the review run.

import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getCommits, withRepo } from "./git.js";
import { reviewCommit } from "./reviewer.js";
import { renderReport } from "./report.js";
import { startServer } from "./server.js";

const DEFAULT_LIMIT = "10";
const DEFAULT_PORT = "3546";
const REPORT_FILE = "commit-review-report.html";

const OPTIONS = {
  url: { type: "string" },
  limit: { type: "string" },
  port: { type: "string" },
  "no-serve": { type: "boolean" },
  help: { type: "boolean", short: "h" },
};

export async function main(argv = process.argv.slice(2)) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: OPTIONS,
      allowPositionals: false,
    }));
  } catch (err) {
    console.error(err.message);
    console.error("\n" + usage());
    process.exitCode = 1;
    return;
  }

  if (values.help) {
    console.log(usage());
    return;
  }

  // The key comes from the environment only, never a flag, so it does not land
  // in shell history or process listings.
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not set.");
    console.error("Set it in your environment and re-run, for example:");
    console.error("  export OPENROUTER_API_KEY=your-key-here");
    process.exitCode = 1;
    return;
  }

  const limit = Number.parseInt(values.limit ?? DEFAULT_LIMIT, 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    console.error(`--limit must be a positive integer, got "${values.limit}".`);
    process.exitCode = 1;
    return;
  }

  const port = Number.parseInt(values.port ?? DEFAULT_PORT, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`--port must be a valid port (1-65535), got "${values.port}".`);
    process.exitCode = 1;
    return;
  }

  try {
    await withRepo(values.url, limit, async (repoPath) => {
      const commits = await getCommits(repoPath, limit);

      if (commits.length === 0) {
        console.log(`No commits found in ${repoPath}.`);
        return;
      }

      console.log(`Reviewing ${commits.length} commit(s) in ${repoPath}\n`);

      const { tally, results } = await reviewAll(commits, { apiKey });

      console.log(summary(tally, commits.length));

      // Build the report from the same results the loop streamed to the
      // terminal. The HTML is rendered now, while the (possibly temporary)
      // repo still exists, so the server can keep serving even after a remote
      // clone is cleaned up.
      const source = values.url ? values.url : repoPath;
      const html = renderReport(results, {
        source,
        total: commits.length,
        tally,
        generatedAt: new Date().toISOString(),
      });

      const reportPath = resolve(process.cwd(), REPORT_FILE);
      await writeFile(reportPath, html, "utf8");
      console.log(`\nReport written to ${reportPath}`);

      // startServer resolves once it is listening; the open socket keeps the
      // process alive until the user stops it, so this is the last thing we do.
      if (!values["no-serve"]) {
        await startServer(html, port);
      }
    });
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }
}

// Note: Each commit gets its own try/catch so one failed API call doesn't kill the
// whole run, it just shows up as an error. Results print as they come in.
// Reviewer is passed in so the loop can be tested without real network calls.
export async function reviewAll(commits, { apiKey, reviewer = reviewCommit } = {}) {
  const tally = { excellent: 0, good: 0, bad: 0, unknown: 0, errors: 0 };
  const results = [];

  let index = 0;
  for (const commit of commits) {
    index += 1;
    const header = `[${index}/${commits.length}] ${commit.shortHash}  ${commit.subject}`;

    try {
      const review = await reviewer(commit, { apiKey });
      tally[review.rating] = (tally[review.rating] ?? 0) + 1;
      results.push({ commit, review });
      console.log(header);
      // rating and alignment are independent judgments, so they get their own labels
      console.log(`      rating: ${review.rating}   alignment: ${review.alignment}`);
      console.log(`      ${review.reasoning || "(no reasoning provided)"}\n`);
    } catch (err) {
      tally.errors += 1;
      results.push({ commit, error: err.message });
      console.log(header);
      console.log(`      error: ${err.message}\n`);
    }
  }

  return { tally, results };
}

function summary(tally, total) {
  return (
    `Reviewed ${total} commit(s): ` +
    `${tally.excellent} excellent, ${tally.good} good, ${tally.bad} bad, ` +
    `${tally.unknown} unknown, ${tally.errors} error(s).`
  );
}

function usage() {
  return [
    "review-commits: review recent git commit messages with an LLM.",
    "",
    "Usage:",
    "  review-commits [options]",
    "",
    "Options:",
    "  --url <url>     Remote repository URL to clone and review.",
    "  --limit <n>     Number of recent commits to review (default: 10).",
    "  --port <n>      Port for the report server (default: 3546).",
    "  --no-serve      Generate the report without starting the server.",
    "  -h, --help      Show this help.",
    "",
    "Environment:",
    "  OPENROUTER_API_KEY   Required. Your OpenRouter API key.",
  ].join("\n");
}