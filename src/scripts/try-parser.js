// Run: node src/scripts/try-parser.js
import { parseReview } from "../reviewer.js";

const cases = [
  {
    name: "clean JSON, rating excellent",
    input: '{"rating": "excellent", "alignment": "aligned", "reasoning": "Clear subject and body."}',
    expect: "excellent",
    expectAlignment: "aligned",
  },
  {
    name: "JSON wrapped in ```json fences",
    input: '```json\n{"rating": "good", "alignment": "vague", "reasoning": "Subject is clear."}\n```',
    expect: "good",
    expectAlignment: "vague",
  },
  {
    name: "unparseable gibberish",
    input: "sorry i cannot help with that",
    expect: "unknown",
    expectAlignment: "unknown",
  },
  {
    name: "non-string input (null)",
    input: null,
    expect: "unknown",
    expectAlignment: "unknown",
  },
  {
    name: "valid JSON, rating not in the rubric (normalize fallback)",
    input: '{"rating": "meh", "alignment": "aligned", "reasoning": "Not one of the three allowed values."}',
    expect: "unknown",
    expectAlignment: "aligned",
  },
  {
    name: "rating in wrong case (EXCELLENT)",
    input: '{"rating": "EXCELLENT", "alignment": "MISLEADING", "reasoning": "All caps from the model."}',
    expect: "excellent",
    // alignment normalization lowercases the same way rating does
    expectAlignment: "misleading",
  },
  {
    name: "valid rating, missing reasoning (fallback message)",
    input: '{"rating": "good", "alignment": "aligned"}',
    expect: "good",
    expectAlignment: "aligned",
    reasoningNotEmpty: true,
  },
  {
    name: "alignment not in the rubric (normalize fallback)",
    input: '{"rating": "good", "alignment": "maybe", "reasoning": "Not one of the three alignment values."}',
    expect: "good",
    expectAlignment: "unknown",
  },
  {
    name: "alignment field missing entirely",
    input: '{"rating": "bad", "reasoning": "Vague message."}',
    expect: "bad",
    expectAlignment: "unknown",
  },
];

let passed = 0;
let failed = 0;

for (const { name, input, expect, expectAlignment, reasoningNotEmpty } of cases) {
  const result = parseReview(input);
  let ok = result.rating === expect;
  if (expectAlignment !== undefined) ok = ok && result.alignment === expectAlignment;
  if (reasoningNotEmpty) ok = ok && result.reasoning.trim().length > 0;

  if (ok) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}`);
    console.error(`        expected rating=${expect}, got rating=${result.rating}`);
    if (expectAlignment !== undefined) {
      console.error(`        expected alignment=${expectAlignment}, got alignment=${result.alignment}`);
    }
    if (reasoningNotEmpty) console.error(`        reasoning: ${JSON.stringify(result.reasoning)}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
