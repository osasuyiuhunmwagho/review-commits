// Serves a single in-memory HTML report over HTTP using only the standard
// library. Every request returns the same report, so there is no routing,
// filesystem access, or user input to sanitize at request time.

import { createServer } from "node:http";

// Starts a server that responds to every GET with the report and resolves once
// it is listening. The returned object exposes the chosen url and a close()
// helper so callers (or tests) can shut it down. The process keeps running
// until the user stops it with Ctrl+C, which is the intended behavior for a
// "view your report" server.
export function startServer(html, port = 3546) {
  const body = String(html ?? "");

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      // A browser will also ask for /favicon.ico; answer it quietly instead of
      // serving the whole report for it.
      if (req.url === "/favicon.ico") {
        res.writeHead(204).end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(body);
    });

    // Surface the common, actionable failure (port already taken) with a clear
    // message instead of a raw stack trace.
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Re-run with --port <n> to pick another.`
          )
        );
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\nReport served at ${url}`);
      console.log("Press Ctrl+C to stop.\n");
      resolve({ url, close: () => new Promise((r) => server.close(r)) });
    });
  });
}
