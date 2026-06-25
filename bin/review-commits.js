#!/usr/bin/env node
// Thin entry point. All argument parsing and orchestration lives in src/cli.js
// so this file stays trivial and the logic stays testable without a process.

import { main } from "../src/cli.js";

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exitCode = 1;
});
