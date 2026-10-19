"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const shared = require("../lib/shared.js");

test("accepts editable Google Docs document URLs", () => {
  const urls = [
    "https://docs.google.com/document/d/abc123/edit",
    "https://docs.google.com/document/d/abc-123_XYZ/view?usp=sharing",
    "https://docs.google.com/document/u/0/d/abc123/edit",
    "https://docs.google.com/document/u/2/d/abc123",
    "https://docs.google.com/document/d/abc123/edit#heading=h.abc123",
    "https://docs.google.com/document/d/abc123/mobilebasic",
    "https://docs.google.com/document/d/abc123/preview",
  ];

  for (const url of urls) {
    assert.equal(shared.isGoogleDocsDocumentUrl(url), true, url);
  }
});

test("rejects non-document, insecure, and lookalike URLs", () => {
  const urls = [
    "http://docs.google.com/document/d/abc123/edit",
    "https://docs.google.com/document/u/0/",
    "https://docs.google.com/document/d/abc123/pub",
    "https://docs.google.com/document/d/e/2PACX-abc/pub",
    "https://docs.google.com/spreadsheets/d/abc123/edit",
    "https://docs.google.com/presentation/d/abc123/edit",
    "https://docs.google.com.evil.example/document/d/abc123/edit",
    "https://example.com/document/d/abc123/edit",
    "https://docs.google.com/document/d//edit",
    "not a url",
  ];

  for (const url of urls) {
    assert.equal(shared.isGoogleDocsDocumentUrl(url), false, url);
  }

  assert.equal(shared.isGoogleDocsDocumentUrl(null), false);
  assert.equal(shared.isGoogleDocsDocumentUrl(undefined), false);
  assert.equal(shared.isGoogleDocsDocumentUrl(42), false);
});

test("normalizes line endings and trims only the passage edges", () => {
  assert.equal(
    shared.normalizePassage("\r\n  First line\r\nSecond  line\rThird\r\n"),
    "First line\nSecond  line\nThird"
  );
  assert.equal(shared.normalizePassage("   \n\t "), "");
  assert.equal(shared.normalizePassage(null), "");
  assert.equal(shared.normalizePassage(123), "");
});

test("counts Unicode code points rather than UTF-16 units", () => {
  assert.equal(shared.countCharacters("a😀b"), 3);
  assert.equal(shared.countCharacters(""), 0);
  assert.equal(shared.countCharacters(null), 0);
});

test("clamps reveal speed to the supported range", () => {
  assert.equal(shared.clampWpm(45), 45);
  assert.equal(shared.clampWpm("65"), 65);
  assert.equal(shared.clampWpm(0), 10);
  assert.equal(shared.clampWpm(999), 160);
  assert.equal(shared.clampWpm(45.6), 46);
  assert.equal(shared.clampWpm("nope"), 45);
});

test("exposes stable pace presets and protocol constants", () => {
  assert.equal(shared.START_SESSION_MESSAGE, "DOCUTYPE_START_SESSION");
  assert.equal(shared.MAX_TEXT_LENGTH, 10000);
  assert.deepEqual(
    shared.SPEEDS.map(({ id, label, wpm }) => ({ id, label, wpm })),
    [
      { id: "gentle", label: "Gentle", wpm: 30 },
      { id: "steady", label: "Steady", wpm: 45 },
      { id: "quick", label: "Quick", wpm: 65 },
    ]
  );
});
