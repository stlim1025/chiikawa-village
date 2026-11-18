// Every picture fits the app's limit with the job board on: shorter look-aheads first
// down to 20 s, then simpler workers, then faceless notes. And how often the village
// makes a new picture with the empty board standing, against without it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { villageScene, bustIds } from "../hooks/scene.mjs";
import { play, frameDefs } from "../hooks/play.mjs";
import { pickPicture } from "../hooks/chiikawa-village.mjs";

const HOURS = [0, 6, 12, 17, 18, 22];
const WEATHERS = ["clear", "cloudy", "shower", "storm", "swirl"];
const TIMES = Array.from({ length: 20 }, (_, i) => i * 6);
const SAID = [
  { who: "hachiware", text: "어디가 문제일까? 조금만 더~" },
  { who: "kurimanju", text: "다 끝나면 한잔하러 가자~" },
];
// The usage sign at its fullest.
const SIGN = [
  { key: "five", percent: 88, note: "~08:38" },
  { key: "week", percent: 88, note: "~12/28" },
  { key: "context", percent: 88, note: "~08:38" },
];

// The picture as the Backdrop hook composes it.
const drawFor = ({ hour, weather, t, jobs, workers = [], said = SAID }) => (ahead, level) => {
  const faces = jobs && level < 3 ? bustIds(jobs.notes) : [];
  const shown = jobs ? { ...jobs, faces: level < 3 } : null;
  const actors = ahead === null ? frameDefs(faces, hour) : play(t, said, hour, ahead, null, { workers, also: faces, plain: Math.min(level, 2) });
  return villageScene({ hour, minute: 0, startAt: t, weather, board: SIGN, jobs: shown, actors }).replace("<svg ", `<svg preserveAspectRatio="xMidYMax slice" `);
};

const FULL = {
  notes: [
    { who: "chiikawa", kind: "search", minutes: 12, mark: "run", isFallen: false },
    { who: "hachiware", kind: "write", minutes: 34, mark: "wait", isFallen: false },
    { who: "usagi", kind: "review", minutes: 5, mark: "done", isFallen: false },
    { who: "kurimanju", kind: "other", minutes: 88, mark: "run", isFallen: false },
    { who: "momonga", kind: "search", minutes: 2, mark: "done", isFallen: true },
    { who: "rakko", kind: "write", minutes: 9, mark: "fail", isFallen: true },
  ],
  extra: 3,
};
const workersAt = (t) => [
  { who: "chiikawa", slot: 0, state: "work", startedAt: t - 30, since: t - 30 },
  { who: "hachiware", slot: 1, state: "wait", startedAt: t - 90, since: t - 10 },
  { who: "usagi", slot: 2, state: "done", startedAt: t - 300, since: t - 2 },
];

const tally = (picks) => {
  const out = {};
  for (const p of picks) out[p] = (out[p] ?? 0) + 1;
  return out;
};

test("worst case always fits at 20s or longer", () => {
  const picks = [];
  const levels = [];
  for (const hour of HOURS)
    for (const weather of WEATHERS)
      for (const t0 of TIMES) {
        const t = 1000 + t0;
        const pick = pickPicture(drawFor({ hour, weather, t, jobs: FULL, workers: workersAt(t) }), true);
        assert.ok(pick.source.length <= 131072, `${hour}h ${weather} t${t0}: ${pick.source.length}`);
        assert.notEqual(pick.ahead, null, `${hour}h ${weather} t${t0} fell back to the scene alone`);
        assert.ok(pick.ahead === 0 || pick.ahead >= 20);
        picks.push(pick.ahead);
        levels.push(pick.level);
      }
  console.log("worst case: look-ahead", tally(picks), "level", tally(levels));
});

// How long a picture lasts before the next: its look-ahead less the 4 s spare (the whole
// loop counts as its 120 s), as the Backdrop hook schedules it.
const lasts = (ahead) => (ahead === 0 ? 120 : ahead - 4);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

test("an empty board, as today", () => {
  // A quiet village (no one talking) and a chatty one, with the board and without.
  for (const said of [[], SAID]) {
    const today = [];
    const withBoard = [];
    for (const hour of HOURS)
      for (const weather of WEATHERS)
        for (const t0 of TIMES) {
          const t = 1000 + t0;
          today.push(pickPicture(drawFor({ hour, weather, t, jobs: null, said }), true).ahead);
          withBoard.push(pickPicture(drawFor({ hour, weather, t, jobs: { notes: [], extra: 0 }, said }), true).ahead);
        }
    const before = mean(today.map(lasts));
    const after = mean(withBoard.map(lasts));
    console.log(`${said.length ? "talking" : "quiet"}: no board ${JSON.stringify(tally(today))} | empty board ${JSON.stringify(tally(withBoard))}`);
    console.log(`  a picture lasts ${before.toFixed(1)} s -> ${after.toFixed(1)} s on average`);
    // The board standing may make new pictures a little more often, not much more.
    assert.ok(after >= before * 0.85, `pictures last ${((1 - after / before) * 100).toFixed(0)}% shorter`);
  }
});

test("with the cast off, a picture with faces fits", () => {
  const pick = pickPicture(drawFor({ hour: 22, weather: "swirl", t: 1000, jobs: FULL }), false);
  assert.equal(pick.ahead, null);
  assert.ok(pick.source.length <= 131072);
  assert.match(pick.source, /id="cv-f-chiikawa-idle"/);
});
