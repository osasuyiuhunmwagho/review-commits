# review-commits

A CLI tool that reviews recent git commit messages using an LLM.

For each commit, the tool assigns a rating (`excellent`, `good`, or `bad`), provides a short explanation, writes the results to an HTML report, and optionally serves that report on a local HTTP server.

The reviews are generated using `openai/gpt-oss-120b:free` through OpenRouter.

## Requirements

* Node.js 18+
* Git installed and available on your `PATH`
* An OpenRouter API key

The project uses only Node's standard library and has no runtime dependencies.

## Setup

Clone the repository and link the CLI:

```bash
cd review-commits
npm link
```

Set your OpenRouter API key:

```bash
export OPENROUTER_API_KEY="sk-or-..."
```

Alternatively, run the tool directly:

```bash
node bin/review-commits.js
```

## Usage

```bash
# Review the last 10 commits in the current repository
review-commits

# Review a remote repository
review-commits --url "https://github.com/better-auth/better-auth"

# Review more commits
review-commits -n 20

# Serve the report on a different port
review-commits --port 8080

# Generate the report without starting the server
review-commits --no-serve

# Show help
review-commits --help
```

The default report URL is:

```text
http://localhost:3546
```

A standalone HTML report is also written to:

```text
commit-review-report.html
```

## How it works

```text
review-commits
      |
      |-- current repo
      |-- remote URL
      |
      v
  git log
      |
      v
  collect recent commits
      |
      v
  send commit data to OpenRouter
      |
      v
  receive rating and explanation
      |
      +--> terminal output
      +--> HTML report
      +--> optional local server
```

When reviewing a remote repository, the tool performs a shallow clone into a temporary directory and removes it when finished.

## Diff-aware reviews

The tool does not evaluate commit messages based only on their text.

Along with the commit message, it also sends the commit's `git show --stat` summary to the model. This allows the model to compare the message against the scope of the changes and flag messages that do not match the underlying commit.

For example, a commit titled `"fix typo"` that modifies many files and hundreds of lines may be marked as misleading.

## Project Structure

| File                    | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `bin/review-commits.js` | CLI entry point                                    |
| `src/cli.js`            | Argument parsing and orchestration                 |
| `src/git.js`            | Reads local commits and clones remote repositories |
| `src/reviewer.js`       | OpenRouter integration and response parsing        |
| `src/report.js`         | HTML report generation                             |
| `src/server.js`         | Local HTTP server                                  |

## Notes

* Uses only the Node.js standard library.
* Git commands are executed with `execFile`.
* Commit messages are escaped before being rendered into HTML.
* API keys are read from `OPENROUTER_API_KEY`.
* Model responses are validated before being used.
* Failed reviews are reported individually instead of stopping the entire run.

## AI Usage

Claude was used as a coding assistant during development.

Generated code was reviewed, tested, and modified before being incorporated into the project. Some generated implementations were replaced or revised during development, including Git command execution and JSON response parsing.

## Limitations

* The free OpenRouter model is rate-limited and may reject requests when limits are exceeded.
* Commit ratings are model-generated judgments and may vary slightly between runs.
* Review quality depends on the quality of the underlying model response.



- - - - - - - - - - 