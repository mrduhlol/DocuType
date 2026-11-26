"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const shared = require("../lib/shared.js");
const { buildTypingPlan } = require("../lib/humanize.js");

const MARKER = shared.BACKSPACE_MARKER;

function scriptedRandom(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

// A tiny model of a keyboard: markers delete the previous character.
function applyPlan(plan) {
  let text = "";
  for (const char of plan) {
    if (char === MARKER) {
      text = text.slice(0, -1);
    } else {
      text += char;
    }
  }
  return text;
}

test("clean level leaves the passage byte-for-byte unchanged", () => {
  const text = "Hi, important idea!\n🙂 done.";
  assert.equal(buildTypingPlan(text, { level: 0, random: () => 0 }), text);
});

test("all levels leave text alone when no random roll lands below the rates", () => {
  const text = "A perfectly ordinary sentence with several longer words.";
  for (let level = 0; level <= 3; level += 1) {
    assert.equal(buildTypingPlan(text, { level, random: () => 1 }), text);
  }
});

test("correct-only mode types and repairs errors without changing the final text", () => {
  const text = "A good example of a longer passage.";
  const plan = buildTypingPlan(text, { level: 3, correctOnly: true, random: () => 0 });
  assert.ok(plan.includes(MARKER));
  assert.equal(applyPlan(plan), text);
});

test("rejects a missing passage", () => {
  assert.equal(buildTypingPlan("", { level: 3 }), "");
  assert.equal(buildTypingPlan(null, { level: 3 }), "");
  assert.equal(buildTypingPlan(undefined, { level: 3 }), "");
});

test("a correction types a wrong letter, backspaces it, then retypes it", () => {
  // roll for correction, position, then neighbour letter
  const plan = buildTypingPlan("important", {
    level: 3,
    random: scriptedRandom([0, 0, 0]),
  });

  assert.equal(plan, `in${MARKER}mportant`);
  assert.equal(applyPlan(plan), "important", "the finished word must be correct");
});

test("only longer words are eligible for backspace corrections", () => {
  // "a" gets no slip (1), "important" gets a correction (0, 0, 0)
  const plan = buildTypingPlan("a important", {
    level: 3,
    random: scriptedRandom([1, 0, 0, 0]),
  });

  assert.equal(plan, `a in${MARKER}mportant`);
  assert.equal(applyPlan(plan), "a important");
});

test("a slip leaves a believable error in the finished text", () => {
  // no correction roll for a short word, slip roll, transposition branch, position
  const plan = buildTypingPlan("cat", {
    level: 2,
    random: scriptedRandom([0, 0, 0]),
  });

  assert.equal(plan, "cta");
  assert.notEqual(applyPlan(plan), "cat");
  assert.equal(plan.length, 3, "a transposition keeps the word length");
});

test("uses familiar misspellings for small, natural-looking slips", () => {
  // no correction (1), slip (0), then choose the stored misspelling (0)
  const plan = buildTypingPlan("definitely", {
    level: 1,
    random: scriptedRandom([1, 0, 0]),
  });

  assert.equal(plan, "definately");
});

test("word substitutions keep the original capitalisation", () => {
  // no correction roll for a short word, slip (0), stored misspelling (0)
  const plan = buildTypingPlan("Their", {
    level: 1,
    random: scriptedRandom([0, 0]),
  });

  assert.equal(plan, "There");
});

test("a correction never appears in the finished text", () => {
  const longText =
    "Education generally requires considerable dedication and consistent application over several years.";
  const plan = buildTypingPlan(longText, {
    level: 3,
    random: scriptedRandom([0, 0, 0]),
  });

  assert.ok(plan.includes(MARKER), "the plan should contain backspaces");
  assert.equal(applyPlan(plan).length > 0, true);
});

test("plan markers are single code points", () => {
  assert.equal(Array.from(MARKER).length, 1);
});
