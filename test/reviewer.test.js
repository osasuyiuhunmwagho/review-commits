// Tests for parseReview, the pure parsing logic in src/reviewer.js.
// parseReview never touches the network, so it runs directly with no API spend.
// Run with: node --test    (or: node test/reviewer.test.js)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseReview, FALLBACK_REASONING } from "../src/reviewer.js";

describe("parseReview", () => {
  it("parses valid JSON", () => {
    const result = parseReview(
      '{"rating": "excellent", "alignment": "aligned", "reasoning": "Clear subject and matches the diff."}'
    );
    // deepEqual pins the whole shape, so a stray or renamed field fails the test
    assert.deepEqual(result, {
      rating: "excellent",
      alignment: "aligned",
      reasoning: "Clear subject and matches the diff.",
    });
  });

  it("parses JSON inside code fences", () => {
    const result = parseReview(
      '```json\n{"rating": "good", "alignment": "vague", "reasoning": "Readable but generic."}\n```'
    );
    assert.equal(result.rating, "good");
    assert.equal(result.alignment, "vague");
    assert.equal(result.reasoning, "Readable but generic.");
  });

  it("extracts JSON surrounded by extra prose", () => {
    const result = parseReview(
      'Sure, here is the review:\n{"rating": "bad", "alignment": "misleading", "reasoning": "Says docs, edits code."}\nLet me know if you need more.'
    );
    assert.equal(result.rating, "bad");
    assert.equal(result.alignment, "misleading");
    assert.equal(result.reasoning, "Says docs, edits code.");
  });

  it("falls back to unknown for an invalid rating", () => {
    const result = parseReview(
      '{"rating": "meh", "alignment": "aligned", "reasoning": "Rating is not one of the three."}'
    );
    assert.equal(result.rating, "unknown");
    // A bad rating must not poison a valid alignment.
    assert.equal(result.alignment, "aligned");
  });

  it("parses a valid alignment value", () => {
    const result = parseReview(
      '{"rating": "good", "alignment": "misleading", "reasoning": "Diff contradicts the message."}'
    );
    assert.equal(result.alignment, "misleading");
  });

  it("falls back to unknown for an invalid alignment", () => {
    const result = parseReview(
      '{"rating": "good", "alignment": "sideways", "reasoning": "Alignment is not one of the three."}'
    );
    assert.equal(result.alignment, "unknown");
    // A bad alignment must not poison a valid rating.
    assert.equal(result.rating, "good");
  });

  it("falls back to unknown for completely invalid input", () => {
    const result = parseReview("this is not JSON at all, just a sentence");
    assert.equal(result.rating, "unknown");
    assert.equal(result.alignment, "unknown");
  });

  it("falls back to unknown for non-string input", () => {
    const result = parseReview(null);
    assert.equal(result.rating, "unknown");
    assert.equal(result.alignment, "unknown");
  });

  it("fills the fallback reasoning when reasoning is missing", () => {
    const result = parseReview('{"rating": "good", "alignment": "aligned"}');
    assert.equal(result.rating, "good");
    assert.equal(result.alignment, "aligned");
    assert.equal(result.reasoning, FALLBACK_REASONING);
  });
});
