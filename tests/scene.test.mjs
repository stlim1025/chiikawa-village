// The job board and the weeding field in the village picture.
import { test } from "node:test";
import assert from "node:assert/strict";
import { villageScene, bustIds } from "../hooks/scene.mjs";

const plain = villageScene({ hour: 12, minute: 0, weather: "clear" });
const empty = villageScene({ hour: 12, minute: 0, weather: "clear", jobs: { notes: [], extra: 0, faces: true } });
const three = {
  notes: [
    { who: "chiikawa", kind: "search", minutes: 1, mark: "run", isFallen: false },
    { who: "usagi", kind: "write", minutes: 4, mark: "wait", isFallen: false },
    { who: "hachiware", kind: "review", minutes: 2, mark: "done", isFallen: true },
  ],
  extra: 2,
  faces: true,
};
const busy = villageScene({ hour: 12, minute: 0, weather: "clear", jobs: three });

test("the board stands even with no jobs", () => {
  assert.match(empty, /id="cv-jb"/);
  assert.doesNotMatch(plain, /id="cv-jb"/);
});

test("no lettering in a font", () => {
  assert.equal((busy.match(/<text/g) ?? []).length, (plain.match(/<text/g) ?? []).length);
  assert.doesNotMatch(busy, /filter/);
});

test("faces point at cast frames", () => {
  // Hachiware's note lies on the grass: a stamp, no face.
  assert.deepEqual(bustIds(three.notes), ["chiikawa-idle", "usagi-hop0"]);
  for (const id of bustIds(three.notes)) assert.match(busy, new RegExp(`href="#cv-f-${id}"`));
  assert.doesNotMatch(busy, /href="#cv-f-hachiware-idle"/);
});

test("faces off draws none", () => {
  const bare = villageScene({ hour: 12, minute: 0, weather: "clear", jobs: { ...three, faces: false } });
  assert.doesNotMatch(bare, /href="#cv-f-/);
});

test("a faceless note and a failed one draw without a face", () => {
  const notes = [
    { who: null, kind: "other", minutes: null, mark: "run", isFallen: false },
    { who: "rakko", kind: "search", minutes: 0, mark: "fail", isFallen: false },
  ];
  assert.deepEqual(bustIds(notes), ["rakko-train0"]);
  assert.match(villageScene({ hour: 12, minute: 0, weather: "clear", jobs: { notes, extra: 0, faces: true } }), /id="cv-jb"/);
});

test("night pen", () => {
  const night = villageScene({ hour: 22, minute: 0, weather: "storm", jobs: three });
  assert.match(night, /#fff3d6/);
  const day = villageScene({ hour: 12, minute: 0, weather: "clear", jobs: { notes: [], extra: 0, faces: true } });
  // By day the board's pen is the dark one; the usage sign is not drawn here.
  assert.doesNotMatch(day, /#fff3d6/);
});

test("the board adds a modest amount", () => {
  // Measured for the size budget; Task 7 reads it.
  console.log("board+field adds", empty.length - plain.length, "| with three notes", busy.length - plain.length);
  assert.ok(empty.length - plain.length < 6000);
});
