// The friends who go out to the weeding field while a job runs, and how they come home.
import { test } from "node:test";
import assert from "node:assert/strict";
import { play, frameDefs, loopAt, returnAt, SLOTS, DONE_LINE, PLAN_FOR_TEST } from "../hooks/play.mjs";

const W = (o) => ({ who: "chiikawa", slot: 0, state: "work", startedAt: 10, since: 10, ...o });

test("a worker walks from where it was to its slot, then pulls", () => {
  const svg = play(10, "", 12, 62, null, { workers: [W()] });
  assert.match(svg, /cv-f-chiikawa-pull0/);
  assert.match(svg, /cv-f-chiikawa-pull1/);
  // One body for Chiikawa: the loop's own acts (sitting by the tea table) are not drawn too.
  assert.doesNotMatch(svg, /href="#cv-f-chiikawa-sit"/);
  const from = loopAt("chiikawa", 10);
  assert.match(svg, new RegExp(`values="${from.x} ${from.y};${SLOTS[0].x} ${SLOTS[0].y}`));
});

test("seeded worker stands at its slot", () => {
  const svg = play(500, "", 12, 62, null, { workers: [W({ startedAt: -Infinity, since: -Infinity })] });
  assert.match(svg, new RegExp(`translate\\(${SLOTS[0].x} ${SLOTS[0].y}\\)`));
});

test("done says the line, then walks back to meet the loop", () => {
  const w = W({ state: "done", since: 200 });
  const svg = play(200, "", 12, 62, null, { workers: [w] });
  assert.match(svg, new RegExp(DONE_LINE));
  const back = loopAt("chiikawa", returnAt(w));
  assert.match(svg, new RegExp(`${back.x} ${back.y}`));
});

test("a friend out in the field still says its line", () => {
  // Hachiware speaks by default; a line said to it must show over it in the field.
  const svg = play(10, "어디가 문제일까?", 12, 62, null, { workers: [W({ who: "hachiware" })] });
  assert.match(svg, /어디가 문제일까\?/);
});

test("the done line comes before any other line", () => {
  const svg = play(200, "어디가 문제일까?", 12, 62, null, { workers: [W({ who: "hachiware", state: "done", since: 200 })] });
  assert.match(svg, new RegExp(DONE_LINE));
  assert.doesNotMatch(svg, /어디가 문제일까\?/);
});

test("a failed job sends the friend home without a word", () => {
  const svg = play(200, "", 12, 62, null, { workers: [W({ state: "fail", since: 200 })] });
  assert.doesNotMatch(svg, new RegExp(DONE_LINE));
});

test("done before arrival turns back from where it is", () => {
  const w = W({ state: "done", startedAt: 10, since: 12 }); // two seconds into the walk out
  const svg = play(12, "", 12, 62, null, { workers: [w] });
  assert.doesNotMatch(svg, new RegExp(`translate\\(${SLOTS[0].x} ${SLOTS[0].y}\\)`));
});

test("plain levels drop frames", () => {
  assert.doesNotMatch(play(10, "", 12, 62, null, { workers: [W()], plain: 1 }), /chiikawa-pull1/);
  assert.doesNotMatch(play(10, "", 12, 62, null, { workers: [W()], plain: 2 }), /chiikawa-pull0/);
});

test("a worker off stage is not drawn", () => {
  assert.doesNotMatch(play(10, "", 12, 62, ["usagi"], { workers: [W()] }), /cv-f-chiikawa-/);
});

test("also keeps the faces' frames", () => {
  assert.match(play(0, "", 12, 20, ["rakko"], { also: ["usagi-hop0"] }), /id="cv-f-usagi-hop0"/);
  assert.match(frameDefs(["hachiware-idle"], 22), /id="cv-f-hachiware-idle"/);
  assert.doesNotMatch(frameDefs(["hachiware-idle"], 22), /id="cv-f-chiikawa-/);
});

test("the loop no longer stands on the board or the field", () => {
  // In front of the board (its legs reach y 968), and on the field.
  const boxes = [
    { x0: 95, x1: 300, y0: 850, y1: 1010 },
    { x0: 300, x1: 545, y0: 905, y1: 985 },
  ];
  for (const { who, stops } of PLAN_FOR_TEST)
    for (const s of stops)
      if (s.act !== "walk")
        for (const b of boxes)
          assert.ok(!(s.x >= b.x0 && s.x <= b.x1 && s.y >= b.y0 && s.y <= b.y1), `${who} stays at ${s.x},${s.y}`);
});
