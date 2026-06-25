# Plan

My thinking before writing code. 

## What this is

The project is to build a `review-commits` CLI that reads recent commits from a local or remote git repo,
then sends each commit message to an LLM (`gpt-oss-120b:free` through OpenRouter), and produces
three valid ratings: excellent / good / bad rating with a short reasoning. Output goes to the terminal and
to an HTML report served on port 3546.

## The three hard requirements

1. Run against a local repo (current working directory).
2. Run against a remote repo from a URL.
3. Write an HTML report and serve it on port 3546.



## The riskiest part, and why I am building it first

The Git and HTTP pieces are straightforward because their behavior is already documented. I can read the docs, run a quick test, and expect the same result every time. The model is different. Even when given the same prompt, there is no guarantee the response will follow the format I asked for.

Because of that, I would connect the OpenRouter API first. If the model returned extra text, markdown, or invalid JSON, I wanted to discover that early while there was still time to make the parser more robust. The uncertain part gets tested first; the predictable parts can wait.


## Build order

1. Skeleton. Zero-dependency Node ESM scaffold, thin entry point, five stub modules
   split by responsibility.
2. LLM slice (the risk). `reviewer.js`: one API call plus a pure, testable parser. Prove
   it works against one commit before anything else.
3. Local extraction. `git.js`: read commits with injection-safe git.
4. Orchestration. `cli.js`: loop the commits, isolate per-commit failures, stream logs.
5. Remote repos. Shallow clone into a temp dir, clean it up afterward.
6. Report and server. HTML report with escaped output, served on 3546.
7. Standout feature. Diff-grounded judging (below).
8. Tests.

 The goal is a working narrow path early and testing icnremently, then widening 
deliberately, not a half-finished wide one.

## Key engineering decisions to make 

- Zero dependencies. I chose not to use any external dependencies because Node 18+ already provides the functionality I needed through fetch, http, and util.parseArgs. Additional packages would have added unnecessary complexity, while the standard library approach keeps the project lightweight and easy to run.
- Injection-safe git. I used execFile with an argument array for all Git commands instead of constructing shell commands with string interpolation. This avoids issues where a malicious or malformed URL could be interpreted as part of a shell command. Each argument is passed directly to Git, which keeps command execution predictable and safer.
- I didn't assume the model would always behave perfectly. The parser handles common issues like markdown code fences or extra explanatory text around the JSON response. If it still can't recover valid data, it returns `"unknown"` instead of crashing, making the application more resilient to unpredictable model output.

- Per-commit error isolation. Each review is wrapped so one failed API call becomes an
  error row and the run continues. One bad response must not ruin the whole job, which
  matters on a rate-limited free tier.
- Clean up after remote clones. The temp dir is removed in a `finally` block so it is
  gone even if the review throws.
- I treated commit messages as untrusted data when generating the HTML report. Before rendering them, all special characters are escaped so they appear as plain text. This prevents commit messages containing HTML or script tags from introducing XSS vulnerabilities into the report.

- Secrets from the environment. The API key comes from `OPENROUTER_API_KEY`, never a flag
  or a hardcoded string.
- Low temperature (0.2). I did this because I want the same commit to score the
  same way across runs, so I keep creativity low.

## Standout feature: diff-grounded judging

Rating a commit message in isolation only checks whether it reads well. It cannot catch a
message that lies about what it did. So alongside the message I pass the commit's
`git show --stat` (files changed, insertions, deletions) and ask the model to also flag
alignment: does the message match the actual scale and nature of the change?

A commit titled "fix typo" that touches 14 files and 600 lines gets flagged as
misleading. This grounds the judge in evidence instead of a one-shot impression, catches
a real failure mode, and stays cheap because `--stat` is compact.

## Out of scope, and what I would add with more time

Keeping the surface small on purpose. With more time: retries with backoff on 429s,
batched requests for large repos, caching by commit hash so re-runs are free, a `--json`
output mode for piping, and a small eval set of hand-labeled commits to measure the
judge's agreement against my own ratings.

## How I am using AI

I am driving with Claude in small, verified slices. Each prompt carries the decision I
have already made, hereby the AI is executing my judgment rather than making it. I review
each response, test the output myself before trusting them, and reject suggestions that miss
these constraints or over-complicating. 