// The cast at play in the village: who stands, sits, walks or does their thing,
// where and when, over one loop of LOOP seconds. Positions are the scene's own
// (1920x1080), and a character's size follows how far back it stands. Walking up
// the picture shows a back, walking down a face, walking across a side.

import { SIZE, FEET, FRAMES } from "./cast-vec.mjs";
import { RETURN_MS } from "./agents.mjs";

export const LOOP = 120;
const BASE = 118; // px a frame is drawn at, at the scene's scale 1
const scaleAt = (y) => 0.92 + (y - 812) * 0.001413;
const f2 = (v) => (Math.round(v * 100) / 100).toString();
const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const escapeXml = (text) => text.replace(/[&<>"']/g, (ch) => ENTITIES[ch]);

// Every frame once (or those in `keep`), its colours through `tint`; the actors
// `use` them.
export function castDefs(keep = null, tint = (markup) => markup) {
  const frames = Object.entries(FRAMES).flatMap(([who, poses]) =>
    Object.entries(poses)
      .filter(([pose]) => !keep || keep.has(`${who}-${pose}`))
      .map(([pose, inner]) => `<g id="cv-f-${who}-${pose}" transform="translate(${-SIZE / 2} ${-FEET})">${tint(inner)}</g>`),
  );
  return `<defs>${frames.join("")}</defs>`;
}

// The night's shade on the cast's colours, `n` from 0 (day) to 1 (night): each
// channel scaled in linear light, as an feColorMatrix would. Done on the colours
// themselves, as an SVG filter on the cast stops the whole picture moving in the app.
const KEEP = [0.4, 0.35, 0.16];
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
function shade(n) {
  const darker = (hex) =>
    `#${[0, 1, 2]
      .map((i) => {
        const c = toSrgb(toLinear(parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255) * (1 - KEEP[i] * n));
        return Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0");
      })
      .join("")}`;
  return (markup) => markup.replace(/#([0-9a-fA-F]{6})\b/g, (_, hex) => darker(hex));
}

const has = (who, pose) => Boolean(FRAMES[who]?.[pose]);
// A frame the character has, or the first of the stand-ins it does have.
const frame = (who, ...poses) => `${who}-${poses.find((p) => has(who, p)) ?? poses[poses.length - 1]}`;

// Frames one after another, each for its own seconds, over and over. A slot is
// [frame, seconds, mirrored?]: a step toward us or away mirrored is the other step.
function flipbook(slots, startAt) {
  const total = slots.reduce((sum, [, s]) => sum + s, 0);
  const use = ([name, , mirrored], extra = "") =>
    `<use href="#cv-f-${name}"${mirrored ? ' transform="scale(-1 1)"' : ""}${extra}`;
  if (slots.length === 1) {
    return `${use(slots[0])}/>`;
  }
  let at = 0;
  const starts = slots.map(([, s]) => { const k = at; at += s; return k; });
  const keyTimes = starts.map((k) => f2(k / total)).join(";");
  const begin = `-${f2(startAt % total)}s`;
  // The frame showing now, so the image is right before its animations run.
  const into = startAt % total;
  const current = starts.findLastIndex((k) => k <= into);
  return slots
    .map((slot, i) => {
      const values = slots.map((_, j) => (j === i ? 1 : 0)).join(";");
      return (
        use(slot, ` opacity="${i === current ? 1 : 0}">`) +
        `<animate attributeName="opacity" values="${values}" keyTimes="${keyTimes}" calcMode="discrete" dur="${f2(total)}s" begin="${begin}" repeatCount="indefinite"/></use>`
      );
    })
    .join("");
}

// A little bounce, for a hop or for a walk drawn with a single frame.
function bounce(body, height, period, startAt) {
  return (
    `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 ${-height};0 0" keyTimes="0;0.3;0.6;1" ` +
    `dur="${period}s" begin="-${f2(startAt % period)}s" repeatCount="indefinite"/>${body}</g>`
  );
}

// What each activity looks like: its flipbook, and a bounce [height, seconds] if any.
const ACTS = {
  idle: (w) => ({ slots: [[frame(w, "idle", "down", "train0"), 1]] }),
  sit: (w) => ({ slots: [[frame(w, "sit", "idle"), 1]] }),
  // Two side steps, one after the other; a single one bobs along instead.
  across: (w) =>
    has(w, "walk1")
      ? { slots: [[frame(w, "walk0"), 0.24], [frame(w, "walk1"), 0.24]] }
      : { slots: [[frame(w, "walk0"), 1]], bounce: [7, 0.42] },
  down: (w) => ({ slots: [[frame(w, "down", "walk0"), 0.26], [frame(w, "down", "walk0"), 0.26, true]] }),
  up: (w) => ({ slots: [[frame(w, "up", "walk0"), 0.26], [frame(w, "up", "walk0"), 0.26, true]] }),
  drink: (w) => ({ slots: [[frame(w, "sit"), 1.8], [frame(w, "drink0"), 2.4]] }),
  hop: (w) => ({ slots: [[frame(w, "idle", "hop0"), 0.45], [frame(w, "hop0"), 0.84]], bounce: [26, 1.29] }),
  pose: (w) => ({ slots: [[frame(w, "idle"), 2.2], [frame(w, "pose"), 1.8]] }),
  train: (w) => ({
    slots: [[frame(w, "train0"), 0.4], [frame(w, "train1"), 0.4], [frame(w, "train0"), 0.4], [frame(w, "train1"), 0.4], [frame(w, "train0"), 1.6]],
  }),
  // Out on the weeding field: tugging at a weed, the tug alone (one frame, a bob) when a
  // picture has to be lighter, a rest while the job waits, and standing up.
  pull: (w) => ({ slots: [[frame(w, "pull0", "idle"), 0.5], [frame(w, "pull1", "pull0", "idle"), 0.5]] }),
  pullOne: (w) => ({ slots: [[frame(w, "pull0", "idle"), 1]], bounce: [4, 0.9] }),
  rest: (w) => ({ slots: [[frame(w, "pull0", "idle"), 1]] }),
  stand: (w) => ({ slots: [[frame(w, "idle", "sit", "hop0", "train0"), 1]] }),
};
function drawAct(act, who, startAt) {
  const { slots, bounce: b } = ACTS[act](who);
  const body = flipbook(slots, startAt);
  return b ? bounce(body, b[0], b[1], startAt) : body;
}

// t: seconds into the loop; x, y: where the feet are. `walk` goes on to the next
// stop, its look and facing worked out from the way it goes; the others stay put,
// facing `face` (1 right, -1 left; 1 if left out).
const PLAN = [
  {
    who: "momonga",
    stops: [
      { t: 0, x: 1570, y: 812, act: "pose", face: -1 },
      { t: 30, x: 1570, y: 812, act: "walk" },
      { t: 38, x: 1570, y: 996, act: "walk" },
      { t: 58, x: 600, y: 955, act: "pose", face: -1 },
      { t: 76, x: 600, y: 955, act: "walk" },
      { t: 96, x: 1570, y: 996, act: "walk" },
      { t: 104, x: 1570, y: 812, act: "pose", face: -1 },
    ],
  },
  {
    who: "kurimanju",
    stops: [
      { t: 0, x: 354, y: 880, act: "drink" },
      { t: 44, x: 354, y: 880, act: "walk" },
      { t: 50, x: 380, y: 996, act: "walk" },
      { t: 70, x: 1400, y: 996, act: "idle" },
      { t: 80, x: 1400, y: 996, act: "walk" },
      { t: 100, x: 380, y: 996, act: "walk" },
      { t: 106, x: 354, y: 880, act: "drink" },
    ],
  },
  {
    who: "chiikawa",
    stops: [
      { t: 0, x: 506, y: 880, act: "sit", face: -1 },
      { t: 34, x: 506, y: 880, act: "walk" },
      { t: 40, x: 540, y: 996, act: "walk" },
      // Stands in front of the tea table, clear of the job board and the field.
      { t: 52, x: 440, y: 893, act: "idle" },
      { t: 62, x: 440, y: 893, act: "walk" },
      { t: 74, x: 540, y: 996, act: "walk" },
      { t: 80, x: 506, y: 880, act: "sit", face: -1 },
    ],
  },
  {
    who: "usagi",
    stops: [
      // Hopping where she stands, walking from one spot to the next.
      { t: 0, x: 1606, y: 930, act: "hop", face: -1 },
      { t: 20, x: 1606, y: 930, act: "walk" },
      { t: 30, x: 1720, y: 1000, act: "hop", face: -1 },
      { t: 50, x: 1720, y: 1000, act: "walk" },
      { t: 62, x: 1340, y: 996, act: "hop", face: 1 },
      { t: 74, x: 1340, y: 996, act: "walk" },
      { t: 90, x: 1606, y: 930, act: "hop", face: -1 },
    ],
  },
  {
    who: "rakko",
    stops: [
      { t: 0, x: 1400, y: 996, act: "train", face: -1 },
      { t: 36, x: 1400, y: 996, act: "walk" },
      { t: 46, x: 1780, y: 996, act: "train", face: -1 },
      { t: 80, x: 1780, y: 996, act: "walk" },
      { t: 92, x: 1400, y: 996, act: "train", face: -1 },
    ],
  },
  {
    who: "hachiware",
    speaks: true,
    stops: [
      // Between the two cushions in front of the tea table, clear of the board and field.
      { t: 0, x: 430, y: 896, act: "idle" },
      { t: 10, x: 430, y: 896, act: "walk" },
      { t: 16, x: 446, y: 894, act: "idle" },
      { t: 28, x: 446, y: 894, act: "walk" },
      { t: 50, x: 1480, y: 996, act: "idle" },
      { t: 58, x: 1480, y: 996, act: "walk" },
      { t: 66, x: 1530, y: 830, act: "idle", face: -1 },
      { t: 76, x: 1530, y: 830, act: "walk" },
      { t: 84, x: 1480, y: 996, act: "walk" },
      { t: 106, x: 430, y: 896, act: "idle" },
    ],
  },
];

// A walk becomes `up`, `down` or `across` by the way to the next stop, and faces it.
function resolve(stops) {
  return stops.map((stop, i) => {
    if (stop.act !== "walk") {
      return { face: 1, ...stop };
    }
    const to = stops[(i + 1) % stops.length];
    const dx = to.x - stop.x, dy = to.y - stop.y;
    const act = Math.abs(dy) > 0.7 * Math.abs(dx) ? (dy < 0 ? "up" : "down") : "across";
    return { ...stop, act, face: dx < 0 ? -1 : 1 };
  });
}

function bubble(text, y) {
  if (!text) {
    return "";
  }
  const w = Math.max(44, [...text].length * 14 + 22);
  return (
    `<g transform="translate(0 ${y})" font-size="15" font-family="Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, sans-serif">` +
    `<path d="M-6 0L0 9L6 0Z" fill="#fffdf7" stroke="#4a3a36" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="${-w / 2}" y="-28" width="${w}" height="28" rx="13" fill="#fffdf7" stroke="#4a3a36" stroke-width="2"/>` +
    `<path d="M-6 -1.5L6 -1.5" stroke="#fffdf7" stroke-width="3"/>` +
    `<text y="-9" text-anchor="middle" fill="#4a3a36">${escapeXml(text)}</text></g>`
  );
}

// How far into the night the hour is: 0 by day, 1 at night, between at dusk and dawn.
function nightness(hour) {
  if (hour >= 7.5 && hour <= 16.5) return 0;
  if (hour >= 19.5 || hour <= 4.5) return 1;
  return hour > 12 ? (hour - 16.5) / 3 : (7.5 - hour) / 3;
}

// Whether the stretch of the loop from `from` to `to` seconds (both taken around
// the loop) meets the stop i of `stops`, which lasts until the next one.
function meets(stops, i, from, to) {
  const start = stops[i].t;
  const end = i + 1 < stops.length ? stops[i + 1].t : LOOP;
  const span = to - from;
  if (span >= LOOP) {
    return true;
  }
  const a = ((from % LOOP) + LOOP) % LOOP;
  const b = a + span;
  return (start < b && end > a) || (start + LOOP < b && end + LOOP > a);
}

// The acts each one does in that stretch.
function actsIn(stops, from, to) {
  return new Set(stops.filter((_, i) => meets(stops, i, from, to)).map((stop) => stop.act));
}

// The frames the play draws between `from` and `to` seconds into the loop.
export function usedFrames(from, to, plan = PLAN) {
  const ids = new Set();
  for (const { who, stops } of plan) {
    for (const act of actsIn(resolve(stops), from, to)) {
      for (const [name] of ACTS[act](who).slots) {
        ids.add(name);
      }
    }
  }
  return [...ids];
}

// What `who` says: `said` is a line for whoever speaks by default (Hachiware), or
// `{ who, text }` for one of the cast, or a list of those (the last one's for each).
const lineOf = (said, who, speaks) => {
  if (typeof said === "string") return speaks ? said : "";
  const lines = Array.isArray(said) ? said : said ? [said] : [];
  return lines.findLast((line) => line.who === who)?.text ?? "";
};

function actor({ who, stops: planned, speaks }, startAt, said, window) {
  const stops = resolve(planned);
  // Acts outside the window draw nothing: a new image comes before they do.
  const wanted = window ? actsIn(stops, window[0], window[1]) : null;
  const timing = `dur="${LOOP}s" begin="-${f2(startAt % LOOP)}s" repeatCount="indefinite"`;
  // Where it is at each stop, back to the start at the end of the loop.
  const points = [...stops, { ...stops[0], t: LOOP }];
  const keyTimes = points.map((p) => f2(p.t / LOOP)).join(";");
  const isStill = stops.length === 1;
  const stopTimes = stops.map((p) => f2(p.t / LOOP)).join(";");
  const acts = [...new Set(stops.map((p) => p.act))];
  const shown = (act) =>
    acts.length === 1
      ? ""
      : `<animate attributeName="opacity" values="${stops.map((p) => (p.act === act ? 1 : 0)).join(";")}" keyTimes="${stopTimes}" calcMode="discrete" ${timing}/>`;
  // Where things stand now, written into the image too, so its first paint, before
  // the animations run, already has everyone in place.
  const into = startAt % LOOP;
  const at = stops.findLastIndex((p) => p.t <= into);
  const from = points[at], to = points[at + 1];
  const share = to.t > from.t ? (into - from.t) / (to.t - from.t) : 0;
  const here = { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
  const now = stops[at];
  const groups = acts
    .map((act) => `<g opacity="${act === now.act ? 1 : 0}">${shown(act)}${!wanted || wanted.has(act) ? drawAct(act, who, startAt) : ""}</g>`)
    .join("");
  const move = ` transform="translate(${f2(here.x)} ${f2(here.y)})"`;
  const moving = isStill
    ? ""
    : `<animateTransform attributeName="transform" type="translate" values="${points.map((p) => `${p.x} ${p.y}`).join(";")}" keyTimes="${keyTimes}" ${timing}/>`;
  const sizeOf = (p) => f2((BASE * scaleAt(p.y)) / SIZE);
  const scaling = ` transform="scale(${sizeOf(here)})"`;
  const sizing = isStill
    ? ""
    : `<animateTransform attributeName="transform" type="scale" values="${points.map(sizeOf).join(";")}" keyTimes="${keyTimes}" ${timing}/>`;
  const isTurning = stops.some((p) => p.face !== stops[0].face);
  const turning = isTurning
    ? `<animateTransform attributeName="transform" type="scale" values="${stops.map((p) => `${p.face} 1`).join(";")}" keyTimes="${stopTimes}" calcMode="discrete" ${timing}/>`
    : "";
  const facing = ` transform="scale(${now.face} 1)"`;
  return {
    body: `<g${move}>${moving}<g${scaling}>${sizing}<g${facing}>${turning}${groups}</g></g></g>`,
    // The bubble goes along, over the night's shade.
    words: lineOf(said, who, speaks) ? `<g${move}>${moving}${bubble(lineOf(said, who, speaks), -BASE * 1.02)}</g>` : "",
  };
}

// The cast as one SVG fragment, one of them saying `said` (see lineOf), shaded for the hour
// (0~24, fractions allowed). With `ahead`, only what the next `ahead` seconds
// draw: frames for later go in the next image. With `only`, just those of the cast
// (by name) are on stage.
// `workers`: those of the cast out on the weeding field for a job (agents.mjs), times in
// seconds on this clock: each is drawn on its own way out and back in place of its part
// in the loop. `also`: frames to define besides (the job notes' faces). `plain`: 1 tugs
// with one frame, 2 has the workers stand, for a picture that must be lighter.
export function play(startAt, said = "", hour = 12, ahead = 0, only = null, { workers = [], also = [], plain = 0 } = {}) {
  const window = ahead ? [startAt % LOOP, (startAt % LOOP) + ahead] : null;
  const onStage = only ? PLAN.filter((one) => only.includes(one.who)) : PLAN;
  const out = workers.filter((w) => onStage.some((one) => one.who === w.who));
  const plan = onStage.filter((one) => !out.some((w) => w.who === one.who));
  const n = nightness(hour);
  // A worker says its lines out in the field as it would at play.
  const speaking = (who) => lineOf(said, who, PLAN.find((one) => one.who === who)?.speaks);
  const parts = [...plan.map((one) => actor(one, startAt, said, window)), ...out.map((w) => worker(w, startAt, plain, n, speaking(w.who)))];
  const cast = parts.map((p) => p.body).join("");
  const keep = new Set(window ? usedFrames(window[0], window[1], plan) : usedFrames(0, LOOP, plan));
  for (const w of out) for (const id of workerFrames(w, plain)) keep.add(id);
  for (const id of also) keep.add(id);
  return castDefs(keep, n ? shade(n) : undefined) + cast + parts.map((p) => p.words).join("");
}

// Just these frames, shaded for the hour: the notes' faces when the cast is not drawn.
export function frameDefs(ids, hour = 12) {
  const n = nightness(hour);
  return castDefs(new Set(ids), n ? shade(n) : undefined);
}

// ---- the weeding field ----
// Where the workers stand in the field (scene.mjs draws it), how fast they walk there and
// back (the loop's own pace), and what one says when its job is done.
export const SLOTS = [{ x: 372, y: 975 }, { x: 500, y: 976 }, { x: 436, y: 958 }];
export const WALK_SPEED = 60;
export const BUBBLE_S = 4;
export const DONE_LINE = "끝났다!";
// For the tests that keep the loop off the board and the field.
export const PLAN_FOR_TEST = PLAN;

const round2 = (v) => Math.round(v * 100) / 100;
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const toward = (a, b, k) => ({ x: round2(a.x + (b.x - a.x) * k), y: round2(a.y + (b.y - a.y) * k) });
const walkAct = (a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.abs(dy) > 0.7 * Math.abs(dx) ? (dy < 0 ? "up" : "down") : "across";
};
const facing = (a, b) => (b.x < a.x ? -1 : 1);

// Where `who` is in the loop `t` seconds in, as the loop draws it.
export function loopAt(who, t) {
  const one = PLAN.find((p) => p.who === who);
  if (!one) return null;
  const stops = one.stops;
  const into = ((t % LOOP) + LOOP) % LOOP;
  const points = [...stops, { ...stops[0], t: LOOP }];
  const at = stops.findLastIndex((p) => p.t <= into);
  const from = points[at], to = points[at + 1];
  const share = to.t > from.t ? (into - from.t) / (to.t - from.t) : 0;
  return toward(from, to, share);
}

// When a worker whose job ended is back where the loop has it.
export const returnAt = (w) => w.since + RETURN_MS / 1000;

// A worker's way, as points in time ({ t, x, y }) and the acts it does from each time on
// ({ t, act, face }), and a line to say ({ from, until, at }) or null.
function wayOf(w, plain) {
  const slot = SLOTS[w.slot] ?? SLOTS[0];
  const fieldFace = w.slot === 1 ? -1 : 1;
  const tug = plain >= 2 ? "stand" : plain === 1 ? "pullOne" : "pull";
  const atWork = w.state === "wait" ? (plain >= 2 ? "stand" : "rest") : tug;
  const s = Number.isFinite(w.startedAt) ? w.startedAt : -Infinity;
  const from = Number.isFinite(s) ? loopAt(w.who, s) : slot;
  const outFor = distance(from, slot) / WALK_SPEED;
  const arrive = s + outFor;
  const at = (t) => (!Number.isFinite(s) || outFor === 0 || t >= arrive ? slot : toward(from, slot, (t - s) / outFor));
  if (w.state === "work" || w.state === "wait") {
    if (!Number.isFinite(s) || outFor === 0) {
      return { points: [{ t: -Infinity, ...slot }], acts: [{ t: -Infinity, act: atWork, face: fieldFace }], line: null };
    }
    return {
      points: [{ t: s, ...from }, { t: arrive, ...slot }],
      acts: [{ t: s, act: walkAct(from, slot), face: facing(from, slot) }, { t: arrive, act: atWork, face: fieldFace }],
      line: null,
    };
  }
  // Done or failed: up from where it is, a word if it went well, then home to meet the
  // loop just as the next picture takes over.
  const here = at(w.since);
  const home = returnAt(w);
  const target = loopAt(w.who, home);
  const backFor = distance(here, target) / WALK_SPEED;
  const leave = Math.max(w.since + BUBBLE_S, home - backFor);
  const back = leave + backFor;
  return {
    points: [{ t: w.since, ...here }, { t: leave, ...here }, { t: back, ...target }],
    acts: [
      { t: w.since, act: "stand", face: fieldFace },
      { t: leave, act: walkAct(here, target), face: facing(here, target) },
      { t: back, act: "stand", face: facing(here, target) },
    ],
    line: w.state === "done" ? { from: w.since, until: w.since + BUBBLE_S, at: here } : null,
  };
}

function workerFrames(w, plain) {
  const ids = new Set();
  for (const { act } of wayOf(w, plain).acts) for (const [name] of ACTS[act](w.who).slots) ids.add(name);
  return ids;
}

// Grass thrown up by a worker's tugging: two blades bobbing over its hands.
const BLADES =
  `<g stroke="#62534e" stroke-width="2.6" stroke-linejoin="round">` +
  [[42, -112, -20, 1.3], [68, -84, 30, 1.7]]
    .map(
      ([x, y, turn, dur]) =>
        `<g transform="translate(${x} ${y})"><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -11;0 0" dur="${dur}s" repeatCount="indefinite"/>` +
        `<path transform="rotate(${turn})" d="M0 0q8-18 29-11q-6 18-29 11z" fill="#86c792"/></g></g>`,
    )
    .join("") +
  `</g>`;

// A worker drawn on its way: one go of each move, from the times on its way, held at
// the end; the picture's own clock starts at `startAt`.
function worker(w, startAt, plain, n, saying = "") {
  const way = wayOf(w, plain);
  const { points, acts, line } = way;
  const first = points[0].t;
  const moves = points.length > 1 && Number.isFinite(first);
  // Where it is now, and what it does now, so the first paint is right.
  const posAt = (t) => {
    if (!moves || t <= first) return points[0];
    const i = points.findLastIndex((p) => p.t <= t);
    const a = points[i], b = points[i + 1];
    return b ? toward(a, b, (t - a.t) / (b.t - a.t || 1)) : a;
  };
  const actAt = (t) => acts[Math.max(0, acts.findLastIndex((p) => p.t <= t))];
  const here = posAt(startAt);
  const now = actAt(startAt);
  // One timeline for all of it: from the way's start to a second past its last turn.
  const last = Math.max(points[points.length - 1].t, acts[acts.length - 1].t);
  const dur = moves ? last - first + 1 : 1;
  const key = (t) => f2(Math.min(1, Math.max(0, (t - first) / dur)));
  const timing = `dur="${f2(dur)}s" begin="${f2(first - startAt)}s" fill="freeze"`;
  const pts = moves ? [...points, { ...points[points.length - 1], t: last + 1 }] : points;
  const sizeOf = (p) => f2((BASE * scaleAt(p.y)) / SIZE);
  const move = ` transform="translate(${f2(here.x)} ${f2(here.y)})"`;
  const moving = moves
    ? `<animateTransform attributeName="transform" type="translate" values="${pts.map((p) => `${p.x} ${p.y}`).join(";")}" keyTimes="${pts.map((p) => key(p.t)).join(";")}" ${timing}/>`
    : "";
  const sizing = moves
    ? `<animateTransform attributeName="transform" type="scale" values="${pts.map(sizeOf).join(";")}" keyTimes="${pts.map((p) => key(p.t)).join(";")}" ${timing}/>`
    : "";
  const steps = moves ? [...acts, { ...acts[acts.length - 1], t: last + 1 }] : acts;
  const stepTimes = steps.map((p) => key(p.t)).join(";");
  const turning = moves && acts.some((p) => p.face !== acts[0].face)
    ? `<animateTransform attributeName="transform" type="scale" values="${steps.map((p) => `${p.face} 1`).join(";")}" keyTimes="${stepTimes}" calcMode="discrete" ${timing}/>`
    : "";
  const kinds = [...new Set(acts.map((p) => p.act))];
  const blades = n ? shade(n)(BLADES) : BLADES;
  const groups = kinds
    .map((act) => {
      const shown =
        kinds.length > 1 && moves
          ? `<animate attributeName="opacity" values="${steps.map((p) => (p.act === act ? 1 : 0)).join(";")}" keyTimes="${stepTimes}" calcMode="discrete" ${timing}/>`
          : "";
      const tugging = act === "pull" || act === "pullOne" ? blades : "";
      return `<g opacity="${act === now.act ? 1 : 0}">${shown}${drawAct(act, w.who, startAt)}${tugging}</g>`;
    })
    .join("");
  const body = `<g${move}>${moving}<g transform="scale(${sizeOf(here)})">${sizing}<g transform="scale(${now.face} 1)">${turning}${groups}</g></g></g>`;
  // The done line, said where it stood up, for as long as BUBBLE_S; else what it says
  // anyway, over its head wherever it goes.
  let words = "";
  if (line && startAt < line.until) {
    const on = startAt >= line.from;
    words =
      `<g transform="translate(${f2(line.at.x)} ${f2(line.at.y)})" opacity="${on ? 1 : 0}">` +
      (on ? "" : `<set attributeName="opacity" to="1" begin="${f2(line.from - startAt)}s" fill="freeze"/>`) +
      `<set attributeName="opacity" to="0" begin="${f2(line.until - startAt)}s" fill="freeze"/>${bubble(DONE_LINE, -BASE * 1.02)}</g>`;
  } else if (saying) {
    words = `<g${move}>${moving}${bubble(saying, -BASE * 1.02)}</g>`;
  }
  return { body, words };
}
