// Renders the review results into a single self-contained HTML report.
//
// Commit messages and diffstats are untrusted input, so every value that comes
// from a commit or the model is passed through escapeHtml before it reaches the
// markup. The styles are inlined so the report is one portable file with no
// external requests.

const RATINGS = ["excellent", "good", "bad", "unknown"];

// Replaces the five characters that can break out of HTML text or attribute
// context. Anything else renders as-is. Non-strings are coerced first so a
// missing field can't throw.
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// results: array of { commit, review } or { commit, error } (the shape cli.js
// collects). meta: { source, total, tally, generatedAt }.
export function renderReport(results = [], meta = {}) {
  const tally = meta.tally ?? countTally(results);
  const total = meta.total ?? results.length;
  const generatedAt = meta.generatedAt ?? new Date().toISOString();
  const source = meta.source ?? "current repository";

  const cards = results.map(renderCard).join("\n");
  const chips = RATINGS.map(
    (r) => `<span class="chip chip--${r}">${tally[r] ?? 0} ${r}</span>`
  )
    .concat(`<span class="chip chip--error">${tally.errors ?? 0} error(s)</span>`)
    .join("\n        ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Commit Review Report</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      line-height: 1.5;
      background: #0f172a;
      color: #e2e8f0;
    }
    .wrap { max-width: 900px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
    .meta { color: #94a3b8; font-size: .9rem; margin: 0 0 1.5rem; }
    .meta code { color: #cbd5e1; }
    .chips { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 2rem; }
    .chip {
      font-size: .8rem; font-weight: 600; padding: .25rem .6rem;
      border-radius: 999px; background: #1e293b; border: 1px solid #334155;
    }
    .chip--excellent { color: #4ade80; border-color: #166534; }
    .chip--good { color: #38bdf8; border-color: #075985; }
    .chip--bad { color: #f87171; border-color: #991b1b; }
    .chip--unknown, .chip--error { color: #cbd5e1; }
    .card {
      background: #1e293b; border: 1px solid #334155; border-radius: 12px;
      padding: 1.1rem 1.25rem; margin-bottom: 1rem;
    }
    .card__top { display: flex; align-items: baseline; gap: .6rem; flex-wrap: wrap; }
    .hash { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #94a3b8; font-size: .85rem; }
    .subject { font-weight: 600; }
    .badge {
      font-size: .72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .03em; padding: .15rem .5rem; border-radius: 6px;
    }
    .badge--excellent { background: #166534; color: #dcfce7; }
    .badge--good { background: #075985; color: #e0f2fe; }
    .badge--bad { background: #991b1b; color: #fee2e2; }
    .badge--unknown { background: #334155; color: #e2e8f0; }
    .badge--error { background: #7c2d12; color: #ffedd5; }
    .align { font-size: .78rem; color: #94a3b8; }
    .reasoning { margin: .6rem 0 0; color: #cbd5e1; }
    .byline { margin: .5rem 0 0; font-size: .8rem; color: #64748b; }
    .err { color: #fca5a5; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Commit Review Report</h1>
    <p class="meta">
      Source: <code>${escapeHtml(source)}</code> &middot;
      ${escapeHtml(String(total))} commit(s) &middot;
      generated ${escapeHtml(generatedAt)}
    </p>
    <div class="chips">
        ${chips}
    </div>
    ${cards || '<p class="meta">No commits to display.</p>'}
  </div>
</body>
</html>
`;
}

function renderCard({ commit = {}, review, error }) {
  const shortHash = escapeHtml(commit.shortHash ?? "");
  const subject = escapeHtml(commit.subject ?? "(no subject)");
  const author = escapeHtml(commit.author ?? "unknown");
  const date = escapeHtml(commit.date ?? "");

  if (error) {
    return `    <div class="card">
      <div class="card__top">
        <span class="hash">${shortHash}</span>
        <span class="subject">${subject}</span>
        <span class="badge badge--error">error</span>
      </div>
      <p class="reasoning err">${escapeHtml(error)}</p>
      <p class="byline">${author} &middot; ${date}</p>
    </div>`;
  }

  const rating = escapeHtml(review?.rating ?? "unknown");
  const alignment = escapeHtml(review?.alignment ?? "unknown");
  const reasoning = escapeHtml(review?.reasoning ?? "");

  return `    <div class="card">
      <div class="card__top">
        <span class="hash">${shortHash}</span>
        <span class="subject">${subject}</span>
        <span class="badge badge--${rating}">${rating}</span>
        <span class="align">alignment: ${alignment}</span>
      </div>
      <p class="reasoning">${reasoning}</p>
      <p class="byline">${author} &middot; ${date}</p>
    </div>`;
}

function countTally(results) {
  const tally = { excellent: 0, good: 0, bad: 0, unknown: 0, errors: 0 };
  for (const { review, error } of results) {
    if (error) tally.errors += 1;
    else tally[review?.rating] = (tally[review?.rating] ?? 0) + 1;
  }
  return tally;
}
