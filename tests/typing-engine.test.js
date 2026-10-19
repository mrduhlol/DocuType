"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { TypingEngine, computeCharDelay } = require("../content/typing-engine.js");

function createManualScheduler() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();

  function setTimeoutFn(callback, delay) {
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, delay), callback });
    return id;
  }

  function clearTimeoutFn(id) {
    timers.delete(id);
  }

  function nextEntry() {
    let next = null;
    for (const [id, timer] of timers) {
      if (!next || timer.at < next.timer.at || (timer.at === next.timer.at && id < next.id)) {
        next = { id, timer };
      }
    }
    return next;
  }

  function advance(ms) {
    const target = now + Math.max(0, ms);
    let guard = 0;

    while (true) {
      const next = nextEntry();
      if (!next || next.timer.at > target) {
        break;
      }

      timers.delete(next.id);
      now = next.timer.at;
      next.timer.callback();

      guard += 1;
      if (guard > 1000) {
        throw new Error("manual scheduler ran too many timers");
      }
    }

    now = target;
  }

  function runNext() {
    const next = nextEntry();
    if (!next) {
      return false;
    }

    advance(next.timer.at - now);
    return true;
  }

  return {
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    advance,
    runNext,
    pending: () => timers.size,
    now: () => now,
  };
}

function createHarness(overrides = {}) {
  const scheduler = createManualScheduler();
  const events = {
    revealed: [],
    states: [],
    resets: 0,
    completions: 0,
  };

  const engine = new TypingEngine({
    text: "Hi!",
    wpm: 45,
    scheduler,
    random: () => 0.5,
    initialDelayMs: 100,
    resumeDelayMs: 50,
    onReveal: (event) => events.revealed.push(event),
    onStateChange: (state, previous) => events.states.push({ state, previous }),
    onReset: () => {
      events.resets += 1;
    },
    onComplete: () => {
      events.completions += 1;
    },
    ...overrides,
  });

  return { engine, scheduler, events };
}

test("reveals exactly one character per tick and completes once", () => {
  const { engine, scheduler, events } = createHarness();

  assert.equal(engine.state, "idle");
  assert.equal(engine.index, 0);
  assert.equal(engine.total, 3);
  assert.equal(engine.start(), true);
  assert.equal(engine.state, "running");
  assert.equal(engine.start(), false, "start is ignored while already running");
  assert.equal(scheduler.pending(), 1);
  assert.equal(events.revealed.length, 0);

  scheduler.runNext();
  assert.deepEqual(events.revealed, [{ char: "H", index: 1, total: 3 }]);
  assert.equal(scheduler.pending(), 1);

  scheduler.runNext();
  assert.deepEqual(events.revealed[1], { char: "i", index: 2, total: 3 });

  scheduler.runNext();
  assert.deepEqual(events.revealed[2], { char: "!", index: 3, total: 3 });
  assert.equal(engine.state, "complete");
  assert.equal(engine.index, 3);
  assert.equal(events.completions, 1);
  assert.equal(scheduler.pending(), 0);

  scheduler.advance(10000);
  assert.equal(events.revealed.length, 3);
  assert.equal(events.completions, 1);
});

test("pause freezes the reveal and resume continues from the same point", () => {
  const { engine, scheduler, events } = createHarness();

  engine.start();
  scheduler.runNext();
  assert.equal(events.revealed.length, 1);

  assert.equal(engine.pause(), true);
  assert.equal(engine.pause(), false, "second pause is a no-op");
  assert.equal(engine.state, "paused");
  assert.equal(scheduler.pending(), 0);

  scheduler.advance(5000);
  assert.equal(events.revealed.length, 1);

  assert.equal(engine.resume(), true);
  assert.equal(engine.resume(), false, "second resume is a no-op");
  assert.equal(engine.state, "running");
  assert.equal(scheduler.pending(), 1);

  scheduler.runNext();
  assert.deepEqual(events.revealed[1], { char: "i", index: 2, total: 3 });
});

test("pausing before the first reveal leaves nothing scheduled", () => {
  const { engine, scheduler, events } = createHarness();

  engine.start();
  assert.equal(scheduler.pending(), 1);
  engine.pause();
  scheduler.advance(5000);

  assert.equal(events.revealed.length, 0);
  assert.equal(scheduler.pending(), 0);

  engine.resume();
  scheduler.runNext();
  assert.deepEqual(events.revealed[0], { char: "H", index: 1, total: 3 });
});

test("restart resets the index and keeps exactly one timer", () => {
  const { engine, scheduler, events } = createHarness();

  engine.start();
  scheduler.runNext();
  scheduler.runNext();
  assert.equal(engine.index, 2);

  assert.equal(engine.restart(), true);
  assert.equal(engine.index, 0);
  assert.equal(events.resets, 1);
  assert.equal(engine.state, "running");
  assert.equal(scheduler.pending(), 1, "old timer must be cleared");

  engine.restart();
  assert.equal(events.resets, 2);
  assert.equal(scheduler.pending(), 1, "restart must never stack timers");

  scheduler.runNext();
  assert.deepEqual(events.revealed.at(-1), { char: "H", index: 1, total: 3 });
});

test("stop clears the timer and prevents further callbacks", () => {
  const { engine, scheduler, events } = createHarness();

  engine.start();
  scheduler.runNext();
  assert.equal(engine.stop(), true);
  assert.equal(engine.stop(), false);
  assert.equal(engine.state, "stopped");
  assert.equal(scheduler.pending(), 0);

  scheduler.advance(10000);
  assert.equal(events.revealed.length, 1);
  assert.equal(events.completions, 0);
});

test("destroy clears pending work and silences callbacks", () => {
  const { engine, scheduler, events } = createHarness();

  engine.start();
  engine.destroy();
  engine.destroy();
  assert.equal(engine.state, "stopped");
  assert.equal(scheduler.pending(), 0);

  scheduler.advance(10000);
  assert.equal(events.revealed.length, 0);
});

test("can restart after completion without duplicating completion", () => {
  const { engine, scheduler, events } = createHarness({ text: "ab" });

  engine.start();
  scheduler.runNext();
  scheduler.runNext();
  assert.equal(engine.state, "complete");
  assert.equal(events.completions, 1);

  assert.equal(engine.restart(), true);
  assert.equal(engine.state, "running");
  assert.equal(engine.index, 0);
  assert.equal(scheduler.pending(), 1);

  scheduler.runNext();
  scheduler.runNext();
  assert.equal(engine.state, "complete");
  assert.equal(events.completions, 2);
});

test("counts and reveals emoji as single code points", () => {
  const { engine, scheduler, events } = createHarness({ text: "a😀b" });

  assert.equal(engine.total, 3);
  engine.start();
  scheduler.runNext();
  scheduler.runNext();
  scheduler.runNext();

  assert.deepEqual(
    events.revealed.map((event) => event.char),
    ["a", "😀", "b"]
  );
  assert.equal(engine.state, "complete");
});

test("supports newlines and repeated whitespace", () => {
  const text = "A\n\n  B";
  const { engine, scheduler, events } = createHarness({ text });

  assert.equal(engine.total, text.length);
  engine.start();
  for (let index = 0; index < text.length; index += 1) {
    scheduler.runNext();
  }

  assert.equal(events.revealed.map((event) => event.char).join(""), text);
  assert.equal(engine.state, "complete");
});

test("rejects an empty passage", () => {
  assert.throws(() => new TypingEngine({ text: "", wpm: 45 }), TypeError);
  assert.throws(() => new TypingEngine({ text: null, wpm: 45 }), TypeError);
});

test("punctuation and line breaks add natural extra delay", () => {
  const random = () => 0.5;
  const letter = computeCharDelay("a", 45, random);
  const comma = computeCharDelay(",", 45, random);
  const period = computeCharDelay(".", 45, random);
  const newline = computeCharDelay("\n", 45, random);

  assert.ok(letter > 0);
  assert.ok(comma > letter);
  assert.ok(period > comma);
  assert.ok(newline > period);
});

test("jitter changes the pace and occasional pauses are longer", () => {
  const base = 12000 / 45;
  const slowJitter = computeCharDelay("a", 45, () => 0);
  const fastJitter = computeCharDelay("a", 45, () => 0.9);

  assert.ok(slowJitter > base, "a 2% thinking pause can occur at random 0");
  assert.ok(fastJitter > base);

  let calls = 0;
  const thinkingPause = computeCharDelay("a", 45, () => {
    calls += 1;
    return calls === 2 ? 0.01 : 0.5;
  });

  assert.ok(thinkingPause > base * 2);
});
