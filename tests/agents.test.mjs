// The job tracker: who goes to work, what each note shows, when it falls and goes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORK_ORDER,
  DROP_MS,
  GONE_MS,
  RETURN_MS,
  kindOf,
  addJob,
  noteTool,
  noteAnswered,
  settle,
  boardOf,
  boardKey,
  nextMinuteAt,
} from "../hooks/agents.mjs";

const job = (id, o = {}) => ({ id, type: "x", task: "t", startedAt: 0, status: "running", now: 0, ...o });

test("assigns friends in order and fills the lowest slot", () => {
  let jobs = addJob([], job("a", { type: "Explore" }), WORK_ORDER);
  jobs = addJob(jobs, job("b", { type: "general-purpose" }), WORK_ORDER);
  assert.deepEqual(jobs.map((j) => [j.worker, j.slot]), [["chiikawa", 0], ["hachiware", 1]]);
});

test("assignment runs out", () => {
  // Only Hachiware on stage, five jobs: one worker, faceless notes, one over the board.
  let jobs = [];
  for (const id of "abcde") jobs = addJob(jobs, job(id, { type: "Explore" }), ["hachiware"]);
  const board = boardOf(jobs, 1000);
  assert.deepEqual(board.workers.map((w) => w.who), ["hachiware"]);
  assert.equal(board.notes.length, 4);
  assert.deepEqual(board.notes.map((n) => n.who), ["hachiware", null, null, null]);
  assert.equal(board.extra, 1);
});

test("minutes, marks and the note's fall", () => {
  let jobs = addJob([], job("a"), WORK_ORDER);
  assert.equal(boardOf(jobs, 125000).notes[0].minutes, 2);
  jobs = settle(jobs, [{ id: "a", status: "waiting" }], 130000).jobs;
  assert.equal(boardOf(jobs, 130000).notes[0].mark, "wait");
  const done = settle(jobs, [{ id: "a", status: "completed" }], 200000);
  assert.equal(done.ended.length, 1);
  assert.equal(boardOf(done.jobs, 200000).notes[0].mark, "done");
  assert.equal(boardOf(done.jobs, 200000 + DROP_MS).notes[0].isFallen, true);
  assert.equal(settle(done.jobs, [], 200000 + GONE_MS).jobs.length, 0);
});

test("a job missing from the list ends once its loop answered", () => {
  let jobs = addJob([], job("w"), WORK_ORDER);
  assert.equal(settle(jobs, [], 1000).ended.length, 0);
  jobs = noteAnswered(jobs, "w");
  assert.equal(settle(jobs, [], 2000).ended[0].status, "completed");
});

test("seeded job has no minutes", () => {
  const jobs = addJob([], job("s", { startedAt: null, now: 5000 }), WORK_ORDER);
  assert.equal(boardOf(jobs, 99999).notes[0].minutes, null);
});

test("a friend comes free again RETURN_MS after its job ends", () => {
  let jobs = addJob([], job("a"), ["chiikawa"]);
  jobs = settle(jobs, [{ id: "a", status: "failed" }], 1000).jobs;
  assert.equal(boardOf(jobs, 1000).workers[0].state, "fail");
  jobs = addJob(jobs, job("b", { startedAt: 2000, now: 2000 }), ["chiikawa"]);
  assert.equal(jobs[1].worker, null);
  jobs = addJob(jobs, job("c", { startedAt: 1000 + RETURN_MS, now: 1000 + RETURN_MS }), ["chiikawa"]);
  assert.equal(jobs[2].worker, "chiikawa");
});

test("the key ignores minutes but not marks", () => {
  const jobs = addJob([], job("a"), WORK_ORDER);
  assert.equal(boardKey(boardOf(jobs, 0)), boardKey(boardOf(jobs, 300000)));
  const waiting = settle(jobs, [{ id: "a", status: "idle" }], 1).jobs;
  assert.notEqual(boardKey(boardOf(jobs, 1)), boardKey(boardOf(waiting, 1)));
});

test("kinds of job", () => {
  assert.equal(kindOf("Explore"), "search");
  assert.equal(kindOf("general-purpose"), "write");
  assert.equal(kindOf("ecc:code-reviewer"), "review");
  assert.equal(kindOf("Plan"), "other");
});

test("tools are noted on running jobs only, the last 24 kept", () => {
  let jobs = addJob([], job("a"), WORK_ORDER);
  for (let i = 0; i < 30; i++) jobs = noteTool(jobs, "a", "Read", `f${i}`);
  assert.equal(jobs[0].toolCount, 30);
  assert.equal(jobs[0].history.length, 24);
  assert.equal(jobs[0].detail, "f29");
  const ended = settle(jobs, [{ id: "a", status: "completed" }], 10).jobs;
  assert.equal(noteTool(ended, "a", "Bash", "ls")[0].tool, "Read");
  assert.deepEqual(noteTool(jobs, "nobody", "Bash", "ls"), jobs);
});

test("the note falls as its friend gets home, so one picture carries both", () => {
  let jobs = addJob([], job("a"), WORK_ORDER);
  jobs = settle(jobs, [{ id: "a", status: "completed" }], 1000).jobs;
  const before = boardOf(jobs, 1000 + RETURN_MS - 1);
  assert.equal(before.workers.length, 1);
  assert.equal(before.notes[0].isFallen, false);
  const home = boardOf(jobs, 1000 + RETURN_MS);
  assert.equal(home.workers.length, 0);
  assert.equal(home.notes[0].isFallen, true);
});

test("the next minute a running note's count turns over", () => {
  // Started at 10 s and at 50 s past: the second one turns first, at 1:50.
  let jobs = addJob([], job("a", { startedAt: 10000, now: 10000 }), WORK_ORDER);
  jobs = addJob(jobs, job("b", { startedAt: 50000, now: 50000 }), WORK_ORDER);
  assert.equal(nextMinuteAt(jobs, 100000), 110000);
  assert.equal(nextMinuteAt(settle(jobs, [{ id: "a", status: "completed" }, { id: "b", status: "completed" }], 1).jobs, 100000), null);
  assert.equal(nextMinuteAt(addJob([], job("s", { startedAt: null }), WORK_ORDER), 100000), null);
});

test("a job already on the board is not added again", () => {
  // Seeded from the engine's list at session start, then spawned under the same id.
  const jobs = addJob(addJob([], job("a", { startedAt: null }), WORK_ORDER), job("a"), WORK_ORDER);
  assert.equal(jobs.length, 1);
});

test("inputs stay as they were", () => {
  const jobs = Object.freeze([]);
  const one = addJob(jobs, job("a"), WORK_ORDER);
  assert.equal(jobs.length, 0);
  Object.freeze(one[0]);
  assert.doesNotThrow(() => settle(one, [{ id: "a", status: "completed" }], 5));
});
