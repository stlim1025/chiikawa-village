// Which reading of the rate-limit windows the usage sign shows when several sessions
// have read them: the later window over an earlier one, the higher figure within one
// (use only grows in a window), and nothing for a window that has started over since.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newestLimits } from "../hooks/chiikawa-village.mjs";

const NOW = Date.parse("2026-11-18T12:00:00Z");
const at = (hours) => new Date(NOW + hours * 3_600_000).toISOString();

test("within one window the higher figure is the newer", () => {
  const here = [{ kind: "five_hour", percentUsed: 40, resetsAt: at(2) }];
  const there = [{ kind: "five_hour", percentUsed: 61, resetsAt: at(2) }];
  assert.deepEqual(newestLimits(NOW, here, there), there);
  assert.deepEqual(newestLimits(NOW, there, here), there);
  // A reset time read a few seconds apart is still the same window.
  const later = [{ kind: "five_hour", percentUsed: 38, resetsAt: new Date(NOW + 2 * 3_600_000 + 2000).toISOString() }];
  assert.deepEqual(newestLimits(NOW, there, later), there);
});

test("a later window wins over a higher figure of an earlier one", () => {
  const old = [{ kind: "seven_day", percentUsed: 90, resetsAt: at(1) }];
  const fresh = [{ kind: "seven_day", percentUsed: 3, resetsAt: at(1 + 24 * 7) }];
  assert.deepEqual(newestLimits(NOW, old, fresh), fresh);
  assert.deepEqual(newestLimits(NOW, fresh, old), fresh);
});

test("each window is chosen on its own, in the order first seen", () => {
  const here = [
    { kind: "five_hour", percentUsed: 40, resetsAt: at(2) },
    { kind: "seven_day", percentUsed: 70, resetsAt: at(50) },
  ];
  const there = [{ kind: "five_hour", percentUsed: 61, resetsAt: at(2) }];
  assert.deepEqual(newestLimits(NOW, here, there), [there[0], here[1]]);
});

test("a window that has started over since its reading is left out", () => {
  const stale = [
    { kind: "five_hour", percentUsed: 95, resetsAt: at(-1) },
    { kind: "seven_day", percentUsed: 30, resetsAt: at(50) },
  ];
  assert.deepEqual(newestLimits(NOW, stale), [stale[1]]);
});

test("a reading without a reset time is kept; what is not a reading is nothing", () => {
  const gateway = [{ kind: "spend_limit", percentUsed: 12 }];
  assert.deepEqual(newestLimits(NOW, gateway, undefined, null, "x", [{ kind: "five_hour" }, 7]), gateway);
});
