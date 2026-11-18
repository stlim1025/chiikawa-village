// Adds newly traced poses to hooks/cast-vec.mjs, made the way the rest of it was:
// traced at 400 (capture/trace.html ?size=400&k=7&eps=3.0&epsSmall=0.8&small=450&mf=2
// &minArea=12&dec=0&detail=260&fill=0.45), every point halved and rounded to the 200
// frame, the seams (stroke widths, joins and colours) dropped. Frames already in the
// file stay as they are.
//
//   node tools/merge-frames.mjs <traced.json> <cast-vec.mjs> pull0 pull1
//   node tools/merge-frames.mjs <traced.json> <cast-vec.mjs> --check chiikawa idle
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [src, castFile, ...rest] = process.argv.slice(2);
const traced = JSON.parse(readFileSync(src, "utf8"));
if (traced.size !== 400) throw new Error(`traced at ${traced.size}, not 400`);

// Each loop's points taken to absolute, halved and rounded, then written relative again.
function halve(d) {
  return d
    .split(/(?=M)/)
    .filter((s) => s.trim())
    .map((s) => {
      const [x0, y0] = s.slice(1).match(/-?\d+/g).map(Number);
      let x = x0, y = y0;
      const r = (v) => Math.round(v / 2);
      let px = r(x0), py = r(y0);
      let out = `M${px} ${py}`;
      for (const seg of s.split("q").slice(1)) {
        const n = (seg.match(/-?\d+/g) || []).map(Number);
        const cx = r(x + n[0]), cy = r(y + n[1]);
        x += n[2];
        y += n[3];
        const ex = r(x), ey = r(y);
        out += `q${cx - px} ${cy - py} ${ex - px} ${ey - py}`.replace(/ -/g, "-");
        px = ex;
        py = ey;
      }
      return `${out}z`;
    })
    .join("");
}
const lite = (inner) =>
  inner
    .replace(/ d="([^"]*)"/g, (_, d) => ` d="${halve(d)}"`)
    .replace(/ stroke-width="[^"]*"/g, "")
    .replace(/ stroke-linejoin="[^"]*"/g, "")
    .replace(/ stroke="#[0-9a-fA-F]{3,8}"/g, "");

const { FRAMES } = await import(pathToFileURL(castFile).href);

if (rest[0] === "--check") {
  const [, who, pose] = rest;
  const made = lite(traced.cast[who][pose]);
  const have = FRAMES[who][pose];
  console.log(made === have ? "SAME" : `DIFFERENT (made ${made.length}, have ${have.length})`);
  if (made !== have) {
    const at = [...made].findIndex((ch, i) => ch !== have[i]);
    console.log("first difference at", at, "\nmade:", made.slice(Math.max(0, at - 60), at + 60), "\nhave:", have.slice(Math.max(0, at - 60), at + 60));
  }
  process.exit(0);
}

const text = readFileSync(castFile, "utf8");
const at = text.indexOf("export const FRAMES = ");
if (at < 0) throw new Error("no FRAMES in " + castFile);
const next = structuredClone(FRAMES);
for (const [who, poses] of Object.entries(traced.cast)) {
  for (const pose of rest) {
    if (!poses[pose] || !next[who]) continue;
    if (next[who][pose]) throw new Error(`${who}.${pose} is already in the file`);
    next[who][pose] = lite(poses[pose]);
    console.log(`${who}.${pose}`, next[who][pose].length, "chars");
  }
}
writeFileSync(castFile, `${text.slice(0, at)}export const FRAMES = ${JSON.stringify(next)};\n`);
