// Reads recent commits from local or remote git repositories.

import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Cap the file list so a commit touching hundreds of files doesn't eat the model's context.
// --stat-count keeps git's own summary line intact (e.g. "30 files changed, 30 insertions(+)"),
// which is the most useful signal for alignment. The char cap is a backstop for absurd filenames.
const STAT_FILE_LIMIT = 20;
const STAT_MAX_CHARS = 2000;

// Fields are separated by the ASCII unit separator (0x1F, %x1f) and records by
// the ASCII record separator (0x1E, %x1e). Neither byte occurs in real commit
// content, so a message can contain newlines, quotes, or shell metacharacters
// without breaking the split.
const FIELDS = ["%H", "%h", "%an", "%aI", "%s", "%b", "%B"];
const PRETTY_FORMAT = FIELDS.join("%x1f") + "%x1e";

export async function getCommits(repoPath, limit) {
  if (typeof repoPath !== "string" || repoPath.length === 0) {
    throw new Error("getCommits: repoPath must be a non-empty string.");
  }

  const count = Number.parseInt(limit, 10);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(
      `getCommits: limit must be a positive integer, got ${String(limit)}.`
    );
  }

  // Built as an args array and run via execFile (no shell), so repoPath is never
  // interpreted by a shell. This is what keeps things safe once the path can come
  // from a user-supplied URL clone.
  const args = [
    "-C",
    repoPath,
    "log",
    "-n",
    String(count),
    `--pretty=format:${PRETTY_FORMAT}`,
  ];

  let stdout;
  try {
    ({ stdout } = await execFileAsync("git", args, {
      maxBuffer: 10 * 1024 * 1024,
    }));
  } catch (err) {
    const detail = String(err.stderr || err.message || "").trim();
    throw new Error(`getCommits: git log failed in "${repoPath}": ${detail}`);
  }

  const commits = stdout
    .split("\x1e")
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map(parseRecord);

  // Sequential so we don't spawn a process per commit all at once. For the typical
  // ten-commit batch the wait is negligible compared to the LLM calls that follow.
  for (const commit of commits) {
    commit.stat = await getCommitStat(repoPath, commit.hash);
  }
  return commits;
}

// --format= suppresses the commit header so only the diffstat reaches the model.
// git show (not diff-tree) handles the initial commit correctly without --root.
// A failed stat degrades gracefully rather than aborting the whole run.
async function getCommitStat(repoPath, hash) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "-C", repoPath,
        "show", "--stat", `--stat-count=${STAT_FILE_LIMIT}`,
        "--format=", "--no-color",
        hash,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    const text = stdout.trim();
    if (text === "") return "(no file changes)";
    if (text.length > STAT_MAX_CHARS) {
      return text.slice(0, STAT_MAX_CHARS).trimEnd() + "\n... (truncated)";
    }
    return text;
  } catch {
    return "(diffstat unavailable)";
  }
}

function parseRecord(record) {
  const [hash, shortHash, author, date, subject, body, message] =
    record.split("\x1f");
  return { hash, shortHash, author, date, subject, body, message };
}

// Resolves the repository path for a run and hands it to the callback. With no
// url, the current directory is used after confirming it is a git repo. With a
// url, the repo is shallow-cloned into a temp dir, used, then removed in a
// finally so it is cleaned up even if the callback throws. Both paths funnel
// through the same callback, so callers never branch on local vs remote.
export async function withRepo(url, limit, callback) {
  if (!url) {
    const repoPath = process.cwd();
    await assertGitRepo(repoPath);
    return await callback(repoPath);
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "review-commits-"));
  try {
    await cloneShallow(url, tmpDir, limit);
    return await callback(tmpDir);
  } finally {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.error(
        `Warning: failed to remove temp dir ${tmpDir}: ${cleanupErr.message}`
      );
    }
  }
}

async function assertGitRepo(repoPath) {
  try {
    await execFileAsync(
      "git",
      ["-C", repoPath, "rev-parse", "--is-inside-work-tree"],
      { maxBuffer: 1024 * 1024 }
    );
  } catch {
    throw new Error(
      `Not a git repository: ${repoPath}\n` +
        "Run review-commits inside a git repository, or pass --url to review a remote one."
    );
  }
}

async function cloneShallow(url, dest, limit) {
  const depth = Number.parseInt(limit, 10);
  const safeDepth = Number.isInteger(depth) && depth > 0 ? depth : 1;
  console.error(`Cloning ${url} (depth ${safeDepth}) ...`);

  // "--" stops git from treating a url beginning with "-" as an option;
  // execFile already keeps the url away from a shell.
  try {
    await execFileAsync(
      "git",
      ["clone", "--depth", String(safeDepth), "--", url, dest],
      { maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (err) {
    const detail = String(err.stderr || err.message || "").trim();
    throw new Error(`Failed to clone ${url}: ${detail}`);
  }
}