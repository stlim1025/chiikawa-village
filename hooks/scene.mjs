// Chiikawa village backdrop: one garden drawn for any time of day and weather.
// Left: cherry tree, picket fence, tea table. Right: cottage with a clock, pond, bridge.
// Pure function: no imports, no Node/DOM APIs. Every id starts with "cv-".
//
// The picture shares one Svg with the cast, so it is written short: what the
// conversation's glass hides is drawn as a few plain shapes, repeated shapes are
// defined once, and every path is packed (`tight`) on the way out.

export const WIDTH = 1920;
export const HEIGHT = 1080;

// Named places where the caller stands or seats a character, in scene coordinates.
// y is where the feet touch; scale multiplies a 92px-tall character (smaller when farther).
export const SPOTS = {
  teaLeft: { x: 354, y: 880, scale: 1 }, // cushion left of the tea table
  teaRight: { x: 506, y: 880, scale: 1 }, // cushion right of the tea table
  porch: { x: 1570, y: 812, scale: 0.92 }, // the cottage step
  pondSide: { x: 1606, y: 930, scale: 1.08 },
  lawn: { x: 296, y: 950, scale: 1.1 }, // open grass in the left third
  walk: { x0: 140, x1: 580, y: 996, scale: 1.18 }, // stepping stones along the front
};

// The conversation sits on frosted glass over the middle of the scene (about 28%..72%
// of its width), with the input box over the foot of it. Nothing small can be made out
// through it, so what lies wholly behind it is left out or drawn as one plain shape.
const GLASS0 = 546; // a little inside the glass's edges (540..1380)
const GLASS1 = 1374;
const veiled = (x, half = 0) => x - half > GLASS0 && x + half < GLASS1;

// ---- small helpers ---------------------------------------------------------------
const TAU = Math.PI * 2;
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lerp = (a, b, t) => a + (b - a) * t;
const mixA = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const mix = (x, y, t) => toHex(mixA(hx(x), hx(y), t));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const z = (n) => String(n).replace(/^(-?)0\./, '$1.'); // .5 for 0.5
const f = (n) => z(Math.round(n * 10) / 10);
const f2 = (n) => z(Math.round(n * 100) / 100);
const whole = Math.round;
const sized = (s) => (Number(s) === 1 ? '' : `scale(${z(s)})`); // nothing for life size

// Path data rewritten to its shortest equal form: each command relative or absolute,
// whichever is shorter, repeated command letters and needless separators left out.
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
const packed = new Map(); // the paths are the same at every draw
function tight(d) {
  let out = packed.get(d);
  if (out !== undefined) return out;
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) || [];
  out = '';
  let cmd = '';
  let last = ''; // the command letter written last
  let dot = false; // whether the number written last has a decimal point
  let x = 0; // where the pen is after what has been written
  let y = 0;
  let x0 = 0; // where the subpath began
  let y0 = 0;
  for (let i = 0; i < toks.length; ) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const up = cmd.toUpperCase();
    if (up === 'Z') {
      out += 'Z';
      last = 'Z';
      x = x0;
      y = y0;
      continue;
    }
    const n = ARGS[up];
    const a = toks.slice(i, i + n).map(Number);
    i += n;
    if (!n || a.length < n || a.some(Number.isNaN)) return d; // not a path this understands
    // Each number as an absolute and as a relative one. `lead` counts those that are not places.
    const lead = up === 'A' ? 5 : 0;
    const isY = (k) => (up === 'V' ? true : up === 'H' ? false : (k - lead) % 2 === 1);
    const here = (k) => (isY(k) ? y : x);
    const rel = cmd !== up;
    const abs = a.map((v, k) => (k < lead ? v : rel ? v + here(k) : v));
    const write = (letter, nums) => {
      const bare = letter === last || (last === 'M' && letter === 'L') || (last === 'm' && letter === 'l');
      let s = bare && up !== 'M' ? '' : letter;
      let wasDot = dot;
      nums.forEach((v, k) => {
        const joined = (k === 0 && s) || v[0] === '-' || (v[0] === '.' && wasDot) || (lead && (k === 4 || k === 5));
        s += (joined ? '' : ' ') + v;
        wasDot = v.includes('.') && !(lead && (k === 3 || k === 4));
      });
      return s;
    };
    const A = abs.map((v) => z(Math.round(v * 100) / 100));
    const R = abs.map((v, k) => (k < lead ? A[k] : z(Math.round((v - here(k)) * 100) / 100)));
    const sa = write(up, A);
    const sr = write(up.toLowerCase(), R);
    const isRel = sr.length < sa.length;
    const nums = isRel ? R : A;
    out += isRel ? sr : sa;
    last = isRel ? up.toLowerCase() : up;
    dot = nums[n - 1].includes('.');
    const land = (k) => (isRel ? here(k) : 0) + Number(nums[k]);
    if (up === 'H') x = land(0);
    else if (up === 'V') y = land(0);
    else {
      const nx = land(n - 2);
      y = land(n - 1);
      x = nx;
    }
    if (up === 'M') {
      x0 = x;
      y0 = y;
    }
    if (up === 'M') cmd = rel ? 'l' : 'L'; // more pairs after a move are lines
  }
  if (packed.size > 1000) packed.clear();
  packed.set(d, out);
  return out;
}
const pack = (s) => s.replace(/ d="([^"]*)"/g, (m, d) => ` d="${tight(d)}"`);

// Small deterministic RNG so stars and flowers stay put between redraws.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Bumpy dome with a flat base: cartoon bush / hedge.
function mound(x, y, w, h, n, r) {
  let d = `M${whole(x - w / 2)} ${whole(y)}`;
  let px = x - w / 2;
  let py = y;
  for (let i = 1; i <= n; i++) {
    const a = Math.PI * (1 - i / n);
    const k = i < n ? 0.93 + r() * 0.14 : 1;
    const nx = x + Math.cos(a) * (w / 2) * (i < n ? k : 1);
    const ny = y - Math.sin(a) * h * k;
    const rad = whole(Math.hypot(nx - px, ny - py) * 0.6);
    d += `A${rad} ${rad} 0 0 1 ${whole(nx)} ${whole(ny)}`;
    px = nx;
    py = ny;
  }
  return `${d}Z`;
}

// Bumpy closed outline around an ellipse: cartoon foliage.
function blob(x, y, rx, ry, n, r) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r() * 0.2;
    const k = 0.93 + r() * 0.14;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  let d = `M${whole(pts[0][0])} ${whole(pts[0][1])}`;
  for (let i = 1; i <= n; i++) {
    const [nx, ny] = pts[i % n];
    const [px, py] = pts[i - 1];
    const rad = whole(Math.hypot(nx - px, ny - py) * 0.6);
    d += `A${rad} ${rad} 0 0 1 ${whole(nx)} ${whole(ny)}`;
  }
  return `${d}Z`;
}

// ---- time of day -----------------------------------------------------------------
// sky: top/middle/horizon. amb/add: light on the ground (multiply, then add). des: desaturation.
// L: lamp strength. star, ff (fireflies), pet (petals), clo (cloud opacity): amounts 0..1.
// cl/cs: cloud light/shade. haze: distance colour. warm/gx/gc: horizon glow amount, x, colour.
const NIGHT = { sky: ['#0a0f2c', '#17235c', '#3d4c8e'], amb: [0.3, 0.35, 0.57], add: [5, 9, 22], des: 0.12, L: 1, star: 1, ff: 1, pet: 0.2, clo: 0.5, cl: '#3b4b86', cs: '#263366', haze: '#1c2856', warm: 0.35, gx: 1500, gc: '#5b62b4', mist: 0.25 };
const DAWN = { sky: ['#6a76b6', '#b9a6d2', '#f7dcc8'], amb: [0.8, 0.78, 0.86], add: [8, 6, 14], des: 0.1, L: 0.3, star: 0.12, ff: 0.2, pet: 0.7, clo: 0.85, cl: '#fbe9e4', cs: '#d6bdd6', haze: '#dccbd8', warm: 0.85, gx: 420, gc: '#ffe2bd', mist: 1 };
const DAY = { sky: ['#a198dd', '#a5bde8', '#b6dbea'], amb: [0.92, 0.92, 0.92], add: [0, 0, 0], des: 0, L: 0, star: 0, ff: 0, pet: 1, clo: 0.96, cl: '#e7e6f1', cs: '#c6c4e6', haze: '#c2dbe9', warm: 0.25, gx: 960, gc: '#ffffff', mist: 0 };
const DUSK = { sky: ['#423f8c', '#c26a84', '#f8a76e'], amb: [0.95, 0.74, 0.64], add: [6, 0, 6], des: 0.03, L: 0.6, star: 0.2, ff: 0.45, pet: 0.8, clo: 0.88, cl: '#fbc39e', cs: '#cf8497', haze: '#e09a84', warm: 1, gx: 1560, gc: '#ffb872', mist: 0 };
const KEYS = [[0, NIGHT], [4.5, NIGHT], [6, DAWN], [7.5, DAY], [16.5, DAY], [18, DUSK], [19.5, NIGHT], [24, NIGHT]];

function phaseAt(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
  const [t0, a] = KEYS[i];
  const [t1, b] = KEYS[i + 1];
  let k = clamp((t - t0) / (t1 - t0), 0, 1);
  k = k * k * (3 - 2 * k);
  const out = {};
  for (const key of Object.keys(a)) {
    const x = a[key];
    const y = b[key];
    if (typeof x === 'number') out[key] = lerp(x, y, k);
    else if (typeof x === 'string') out[key] = mix(x, y, k);
    else if (typeof x[0] === 'number') out[key] = mixA(x, y, k);
    else out[key] = x.map((s, j) => mix(s, y[j], k));
  }
  return out;
}

// grey: how overcast the sky is. amb/ambN: ground light by day / by night. lit: lamps forced on.
const WX = {
  clear: { grey: 0, amb: 1, ambN: 1, des: 0, lit: 0, clouds: 6, rain: 0 },
  swirl: { grey: 0.08, amb: 0.98, ambN: 1, des: 0, lit: 0, clouds: 5, rain: 0 },
  cloudy: { grey: 0.5, amb: 0.9, ambN: 0.93, des: 0.2, lit: 0.12, clouds: 13, rain: 0 },
  shower: { grey: 0.68, amb: 0.82, ambN: 0.88, des: 0.28, lit: 0.4, clouds: 14, rain: 1 },
  storm: { grey: 0.9, amb: 0.6, ambN: 0.78, des: 0.38, lit: 0.85, clouds: 15, rain: 2 },
};

const CLOUDS = [
  [570, 196, 1.2, 1], [1525, 236, 1, 2], [1265, 350, 0.9, 2], [985, 146, 1.1, 2], [1806, 380, 0.72, 1], [770, 356, 0.8, 1],
  [120, 176, 0.9, 2], [330, 250, 1.3, 2], [1690, 136, 1.5, 1], [1120, 240, 1.4, 1], [650, 112, 1.2, 2], [1880, 222, 1.1, 2],
  [1400, 426, 0.8, 1], [585, 436, 0.75, 2], [915, 446, 0.9, 1],
];
const TWINKLES = [
  [1432, 152], [470, 120], [1562, 92], [800, 160], [1704, 182], [300, 92], [1852, 122], [1000, 90], [1484, 336], [580, 262],
  [1764, 304], [1200, 240], [1892, 262], [150, 150], [1622, 424], [920, 380], [640, 420], [1300, 120], [1368, 250], [1930, 420],
];
const FLIES = [
  [1600, 880], [455, 780], [1440, 900], [215, 885], [1760, 962], [560, 730], [1500, 692], [345, 962], [1870, 922], [120, 900],
  [900, 880], [1700, 862], [300, 742], [1530, 982], [610, 832], [1820, 852], [70, 762], [1400, 762], [520, 902], [1680, 1012],
  [1180, 900], [395, 692], [1900, 762], [180, 1002], [1460, 822], [760, 800], [1850, 1022], [480, 1012], [1580, 642], [150, 702],
  [1050, 762], [1740, 902], [585, 962], [1420, 1002], [260, 642], [1890, 642], [980, 982], [430, 602], [1660, 742], [1280, 822],
];
const CAST = {}; // marks the cast's place in the drawing
// Tree lines standing in for the far rows of trees where the glass blurs them.
const FAR0 = '604Q640 572 705 600T835 598T965 604T1095 596T1225 602T1344 600';
const FAR1 = '622Q650 596 725 620T875 616T1025 622T1175 614T1344 620';
const PETALS = [
  [360, 480], [1520, 460], [130, 600], [480, 560], [1760, 470], [300, 610], [540, 480], [900, 620], [210, 520], [1420, 560],
  [420, 640], [560, 650], [1880, 560], [60, 470], [250, 700], [1100, 540], [390, 750], [1640, 400], [520, 760], [110, 720],
  [600, 560], [1450, 700], [330, 820], [760, 500], [170, 830], [1900, 700], [1250, 650], [1000, 760],
];

// `clock` is the time on the house clock, { hour, minute, second }, when it is not the
// hour the sky shows (a part of the day picked by hand).
export function villageScene({ hour, minute, second = 0, startAt = 0, weather = 'clear', actors = '', clock = null } = {}) {
  const hr = Number(hour);
  const mn = Number(minute);
  const hh = Number.isFinite(hr) ? ((Math.floor(hr) % 24) + 24) % 24 : 12;
  const mm = Number.isFinite(mn) ? clamp(mn, 0, 59) : 0;
  const t = hh + mm / 60;
  const sa = Math.max(0, Number(startAt) || 0);
  const wx = Object.hasOwn(WX, weather) ? weather : 'clear';
  const Wx = WX[wx];
  const P = phaseAt(t);
  const dayness = 1 - P.L;

  // ---- colour under the current light ----
  const skyDim = lerp(lerp(1, 0.84, Wx.grey), lerp(1, 0.66, Wx.grey), dayness);
  const greyed = (hex) => {
    const a = hx(hex);
    const g = a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11;
    return toHex(mixA(a, [g * 0.9, g * 0.96, g * 1.07], Wx.grey).map((v) => v * skyDim));
  };
  const sky = P.sky.map(greyed);
  const haze = greyed(P.haze);
  const cl = greyed(P.cl);
  const cs = greyed(P.cs);
  const ambK = lerp(Wx.ambN, Wx.amb, dayness);
  const amb = P.amb.map((v) => v * ambK);
  const des = Math.min(0.8, P.des + Wx.des);
  const L = Math.max(P.L, Wx.lit);
  const memo = new Map();
  const c = (hex) => {
    let v = memo.get(hex);
    if (!v) {
      const a = hx(hex);
      const g = a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11;
      v = toHex(a.map((ch, i) => lerp(ch, g, des) * amb[i] + P.add[i]));
      memo.set(hex, v);
    }
    return v;
  };
  const fog = (hex, k) => mix(c(hex), haze, k);
  const ol = c('#6b5a55');
  const GLOW = '#ffd27a';
  const lamp = (hex) => mix(c(hex), '#ffdf8e', clamp(L * 1.5, 0, 1)); // something that lights up
  const bloom = (hex) => mix(c(hex), hex, 0.3 * P.L); // petals keep a little of their own colour after dark

  // ---- animation helpers: every loop starts `startAt` seconds in ----
  const beg = (dur, off) => `begin="-${Math.round(((((sa + off) % dur) + dur) % dur) * 100) / 100}s"`;
  const anim = (attr, values, dur, off = 0, more = '') =>
    `<animate attributeName="${attr}" values="${values}" dur="${dur}s" ${beg(dur, off)} repeatCount="indefinite"${more}/>`;
  const animT = (type, values, dur, off = 0, more = '') =>
    `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${dur}s" ${beg(dur, off)} repeatCount="indefinite"${more}/>`;
  // Lamplight: drawn inside a group filled with the glow.
  const LIT = `<g fill="url(#cv-gw)">`;
  const halo = (x, y, r, op) => (op > 0.02 ? `<circle cx="${x}" cy="${y}" r="${r}" opacity="${f2(op)}"/>` : '');
  const OUT = `stroke="${ol}" stroke-width="2.5"`;

  const D = []; // defs
  const o = []; // drawing, back to front

  // ---- shared paint ----
  const grad = (id, a, b) => `<linearGradient id="${id}" x2="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const radial = (id, col, a0, a1) =>
    `<radialGradient id="${id}"><stop stop-color="${col}" stop-opacity="${z(a0)}"/><stop offset=".4" stop-color="${col}" stop-opacity="${z(a1)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
  D.push(
    `<linearGradient id="cv-sky" x2="0" y2="1"><stop stop-color="${sky[0]}"/><stop offset=".52" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>`,
    grad('cv-lawn', c('#c6eaac'), c('#a2d79b')),
    grad('cv-wat', c('#bfe7f0'), c('#8fcde6')),
    radial('cv-gw', GLOW, 0.85, 0.3),
    radial('cv-hz', greyed(P.gc), 0.7, 0.3),
  );

  D.push(`<path id="cv-sp" d="M0-9Q1-1 9 0Q1 1 0 9Q-1 1-9 0Q-1-1 0-9Z"/>`);

  // Greens used all over.
  const gStem = c('#6fb37a');
  const gLeaf = c('#93d391');
  const gDark = c('#7cc08a');
  const gMid = c('#9bd596');
  const gLite = c('#b9e6a6');

  // ================= sky =================
  o.push(`<rect width="1920" height="704" fill="url(#cv-sky)"/>`);
  if (P.warm > 0.03) {
    o.push(`<ellipse cx="${f(P.gx)}" cy="684" rx="980" ry="330" fill="url(#cv-hz)" opacity="${f2(P.warm * (1 - Wx.grey * 0.8))}"/>`);
  }

  const starK = P.star * clamp(1 - Wx.grey * 1.25, 0, 1);
  if (starK > 0.2) {
    const r = rng(23);
    const d = ['', '', ''];
    // No stars behind the glass, off the edge of the picture, or deep inside the cherry
    // blossom, the tree crowns and the cottage roof, which stand in front of the sky.
    const COVER = [[255, 418, 166, 112], [168, 330, 103, 69], [348, 316, 107, 71], [44, 548, 94, 104], [1420, 612, 67, 74], [1872, 500, 91, 104]];
    const hidden = (x, y) => veiled(x, 9) || x > 1929 || (x > 1590 && x < 1790 && y > 545) || COVER.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1);
    for (let i = 0; i < 150; i++) {
      const x = Math.round(r() * 1920);
      const y = Math.round(6 + Math.pow(r(), 1.35) * 620);
      const k = r();
      if (!hidden(x, y)) d[k < 0.58 ? 0 : k < 0.9 ? 1 : 2] += `M${x} ${y}h.1`;
    }
    D.push(radial('cv-mw', '#cfd6ff', 0.2, 0.09));
    [3.1, 4.3, 5.2].forEach((dur, i) => D.push(`<use id="cv-tw${i}" href="#cv-sp">${anim('opacity', '1;.2;1', dur, i * 1.3)}</use>`));
    o.push(
      `<g opacity="${f2(starK)}"><ellipse cx="860" cy="300" rx="820" ry="100" transform="rotate(-22 860 300)" fill="url(#cv-mw)"/>` +
        `<g stroke="#eef1ff"><path stroke-width="1.5" opacity=".75" d="${d[0]}"/><path stroke-width="2.4" d="${d[1]}"/><path stroke-width="3.4" d="${d[2]}"/></g>` +
        `<g fill="#fff8d6">${TWINKLES.map(([x, y], i) => (hidden(x, y) ? '' : `<use href="#cv-tw${i % 3}" x="${x}" y="${y}"/>`)).join('')}</g></g>`,
    );
  }

  // Sun by day (left in the morning, right in the afternoon), crescent moon by night.
  const skyClear = clamp(1 - Wx.grey * 1.15, 0, 1);
  if (t > 5.3 && t < 18.7 && skyClear > 0.05) {
    const p = clamp((t - 5.5) / 13, 0, 1);
    const cs0 = Math.cos(Math.PI * p);
    const sn = Math.sin(Math.PI * p);
    const x = 960 - 880 * Math.sign(cs0) * Math.sqrt(Math.abs(cs0));
    const y = 640 - 420 * Math.pow(sn, 0.7);
    const col = mix('#f7a878', '#f6e7b8', clamp(sn * 1.6, 0, 1));
    D.push(radial('cv-gs', col, 0.6, 0.2));
    o.push(`<g opacity="${f2(skyClear * (1 - P.star))}"><circle cx="${f(x)}" cy="${f(y)}" r="170" fill="url(#cv-gs)"/><circle cx="${f(x)}" cy="${f(y)}" r="36" fill="${col}"/></g>`);
  }
  if (P.star > 0.1 && skyClear > 0.05) {
    const q = clamp(((t < 12 ? t + 24 : t) - 18.5) / 11, 0, 1);
    const x = 1410 + 420 * q;
    const y = 252 + 220 * Math.pow(q, 1.4);
    D.push(radial('cv-gm', '#fff2c4', 0.5, 0.16));
    o.push(
      `<g opacity="${f2(skyClear * clamp(P.star * 1.4, 0, 1))}" transform="translate(${f(x)} ${f(y)})"><circle r="150" fill="url(#cv-gm)"/>` +
        `<circle r="31" fill="#fff" opacity=".07"/><path transform="rotate(-24)" d="M9-30A31 31 0 1 0 9 30A25 25 0 1 1 9-30Z" fill="#fff4c9"/>` +
        `<use href="#cv-sp" x="46" y="-34" fill="#fff8d6" transform="scale(.6)" opacity=".9"/></g>`,
    );
  }

  // Clouds: a darker copy peeks out under a lighter one.
  D.push(
    `<g id="cv-ca"><rect x="-104" y="-34" width="208" height="34" rx="17"/><circle cx="-62" cy="-30" r="30"/><circle cx="-18" cy="-52" r="40"/><circle cx="34" cy="-40" r="34"/><circle cx="72" cy="-24" r="24"/></g>`,
    `<g id="cv-cb"><rect x="-80" y="-28" width="160" height="28" rx="14"/><circle cx="-40" cy="-26" r="26"/><circle cx="4" cy="-42" r="32"/><circle cx="44" cy="-26" r="22"/></g>`,
    `<g id="cv-c1"><use href="#cv-ca" fill="${cs}"/><use href="#cv-ca" x="-5" y="-8" fill="${cl}"/></g>`,
    `<g id="cv-c2"><use href="#cv-cb" fill="${cs}"/><use href="#cv-cb" x="-4" y="-7" fill="${cl}"/></g>`,
  );
  {
    const n = P.star > 0.5 && Wx.clouds < 8 ? 4 : Wx.clouds;
    const sets = ['', ''];
    CLOUDS.slice(0, n).forEach(([x, y, s, v], i) => {
      sets[i % 2] += `<use href="#cv-c${v}" transform="translate(${x} ${y})${sized(s)}"/>`;
    });
    if (Wx.rain) {
      // A heavy bank low enough to stay in view when a wide window crops the top.
      [[150, 300], [640, 268], [1130, 296], [1620, 272], [2050, 300]].forEach(([x, y], i) => {
        sets[i % 2] += `<use href="#cv-c1" transform="translate(${x} ${y})${sized(Wx.rain > 1 ? 2.7 : 2.3)}"/>`;
      });
    }
    const op = f2(clamp(P.clo + Wx.grey * 0.5, 0, 1));
    o.push(`<g opacity="${op}"><g>${animT('translate', '0 0;18 0;0 0', 17)}${sets[0]}</g><g>${animT('translate', '0 0;-14 0;0 0', 13, 4)}${sets[1]}</g></g>`);
  }

  // Swirl weather: three trailing wind arms turn over a soft glow while petals circle.
  if (wx === 'swirl') {
    const wind = mix(cl, '#ffffff', 0.6);
    const petal = mix(c('#f9b9c9'), '#ffd9e2', 0.5);
    D.push(
      `<path id="cv-e" d="M0-6C5-5 6 2 0 7C-6 2-5-5 0-6Z"/>`,
      `<g id="cv-arm"><path d="M196 0A158 158 0 0 1-120 0" stroke-width="11"/><path d="M-120 0A96 96 0 0 1 72 0" stroke-width="8"/><path d="M72 0A57 57 0 0 1-42 0" stroke-width="5.5"/><path d="M-42 0A33 33 0 0 1 24 0" stroke-width="3.5"/></g>`,
      radial('cv-gv', mix(wind, '#ffe3ea', 0.4), 0.5, 0.26),
    );
    // The three arms and the rings of circling petals are drawn once and shared.
    let ring = '';
    [[188, 15], [150, 12], [112, 9.5], [76, 7.5], [44, 6]].forEach(([rad, turn], i) => {
      ring += `<g>${animT('rotate', '0;360', turn, i * 2.1)}<use href="#cv-e" x="${rad}" transform="rotate(${i * 97})"/><use href="#cv-e" x="${-rad}" y="12" transform="rotate(${i * 97 + 40})"/></g>`;
    });
    D.push(
      `<g id="cv-a3"><circle r="240" fill="url(#cv-gv)" opacity=".8"/><g fill="none" stroke="${wind}" opacity=".55"><use href="#cv-arm"/><use href="#cv-arm" transform="rotate(120)"/><use href="#cv-arm" transform="rotate(240)"/></g></g>`,
      `<g id="cv-rg" fill="${petal}">${ring}</g>`,
    );
    // `turn` sets the petals of one swirl apart from the next. Without it the swirl is the
    // one behind the glass: no petals, and it stands still.
    const swirl = (x, y, s, dur, off, turn) =>
      `<g transform="translate(${x} ${y})${sized(s)}">` +
      (turn === undefined ? `<use href="#cv-a3"/>` : `<use href="#cv-a3">${animT('rotate', '0;120', dur, off)}</use><use href="#cv-rg"${turn ? ` transform="rotate(${turn})"` : ''}/>`) +
      `</g>`;
    o.push(swirl(1640, 330, 1, 7, 0, 0), swirl(610, 300, 0.7, 5.5, 1.4, 50), swirl(1130, 300, 0.85, 8, 0.7));
  }

  // ================= far land =================
  o.push(
    `<path d="M0 614C160 566 330 548 520 584S860 624 1040 586 1380 528 1560 552 1820 594 1920 566V720H0Z" fill="${fog('#bfe2b6', 0.62)}"/>`,
    `<path d="M0 642C220 604 420 622 640 636S1080 606 1300 626 1700 652 1920 616V720H0Z" fill="${fog('#afdca8', 0.4)}"/>`,
  );
  D.push(
    `<path id="cv-r" d="M-4 0V-30H4V0Z${blob(0, -52, 30, 31, 8, rng(2))}"/>`,
    `<path id="cv-n" d="M0-98C-6-80-16-68-24-60C-19-60-15-60-12-61C-18-46-26-36-34-28C-26-27-18-28-7-30V0H7V-30C18-28 26-27 34-28C26-36 18-46 12-61C15-60 19-60 24-60C16-68 6-80 0-98Z"/>`,
  );
  {
    const r = rng(41);
    const rows = ['', ''];
    for (let x = -30; x < 1960; x += 40 + r() * 32) {
      const s = 0.9 + r() * 0.75;
      const kind = r() < 0.36 ? 'n' : 'r';
      const row = r() < 0.5 ? 0 : 1;
      const y = Math.round(676 + r() * 6);
      // left out: trees behind the glass, and those that stand wholly behind the cottage
      if (!veiled(x, 34 * s) && !(x > 1590 && x < 1790 && s < 1.5)) rows[row] += `<use href="#cv-${kind}" transform="translate(${Math.round(x)} ${y})${sized(f(s))}"/>`;
    }
    // Behind the glass the two rows of trees are two rolling bands, and the far village is left out.
    rows[0] += `<path d="M576 700V${FAR0}V700Z"/>`;
    rows[1] += `<path d="M576 700V${FAR1}V700Z"/>`;
    o.push(`<g fill="${fog('#8ecb9c', 0.46)}">${rows[0]}</g><g fill="${fog('#7dbd8e', 0.22)}">${rows[1]}</g>`);
    if (P.mist > 0.03) {
      // low mist over the far meadow at dawn
      o.push(`<g fill="${mix(cl, '#ffffff', 0.4)}" opacity="${f2(P.mist * 0.42)}"><ellipse cx="420" cy="672" rx="520" ry="26"/><ellipse cx="1240" cy="664" rx="600" ry="22"/><ellipse cx="1760" cy="690" rx="300" ry="16"/></g>`);
    }
  }

  // ================= lawn =================
  o.push(
    `<path d="M0 668C300 648 620 664 960 668S1620 650 1920 660V1080H0Z" fill="url(#cv-lawn)"/>`,
    `<g fill="${gLite}" opacity=".5"><ellipse cx="330" cy="905" rx="250" ry="30"/><ellipse cx="1010" cy="850" rx="330" ry="34"/><ellipse cx="1560" cy="876" rx="170" ry="20"/><ellipse cx="820" cy="730" rx="260" ry="18"/></g>`,
    `<path d="M0 1046C120 1030 240 1052 380 1040S640 1058 800 1050 1100 1060 1300 1052 1560 1034 1700 1046 1860 1040 1920 1034V1080H0Z" fill="${c('#94cf92')}"/>`,
    `<g fill="${c('#7fbf88')}" opacity=".3"><ellipse cx="262" cy="812" rx="205" ry="24"/><ellipse cx="1688" cy="806" rx="250" ry="17"/><ellipse cx="430" cy="876" rx="150" ry="17"/></g>`,
  );

  {
    const r = rng(31);
    let ticks = '';
    for (let i = 0; i < 80; i++) {
      const y = 700 + Math.pow(r(), 0.7) * 290;
      const h = y > 850 ? 9 : 6;
      const x = Math.round(r() * 1920);
      if (!veiled(x, 6)) ticks += `M${x} ${Math.round(y)}l3-${h}l3 ${h}`;
    }
    // Fallen petals under the cherry tree: small tilted ovals, each a short stroke with round ends.
    let fallen = '';
    for (let i = 0; i < 22; i++) {
      const a = r() * TAU;
      const k = Math.sqrt(r());
      const x = Math.round(300 + Math.cos(a) * 250 * k);
      const y = Math.round(850 + Math.sin(a) * 58 * k);
      const tilt = Math.round(r() * 60 - 30);
      const dx = 4.8 * Math.cos((tilt * Math.PI) / 180);
      const dy = 4.8 * Math.sin((tilt * Math.PI) / 180);
      fallen += `M${f(x - dx / 2)} ${f(y - dy / 2)}l${f(dx)} ${f(dy)}`;
    }
    o.push(`<path d="${ticks}" fill="none" stroke="${c('#8cca8c')}" stroke-width="2" opacity=".75"/><path d="${fallen}" stroke="${c('#f9c0cf')}" stroke-width="4.8"/>`);
  }

  // ================= back garden: trees, bushes, fence =================
  const tr = rng(5);
  const trunkCol = c('#c39a82');
  const trunkShade = c('#a98068');
  const crown = (x, y, rx, ry, n, dark, lite) =>
    `<path d="${blob(x, y, rx, ry, n, tr)}" fill="${dark}"/><path d="${blob(x - rx * 0.16, y - ry * 0.2, rx * 0.66, ry * 0.6, Math.max(6, n - 3), tr)}" fill="${lite}" stroke="none"/>`;
  // One outline for everything from here to the cherry tree.
  o.push(`<g ${OUT}>`);
  {
    // green trees framing the scene
    const left = crown(44, 548, 112, 124, 11, c('#86c792'), c('#a4da9f'));
    crown(670, 616, 72, 80, 9, '', ''); // behind the glass: a plain crown, but the same turn of the dice
    o.push(
      `<path d="M30 800C36 740 34 700 30 640H58C54 700 56 750 62 800Z" fill="${trunkShade}"/>${left}` +
        `<path d="M660 800V690H680V800Z" fill="${trunkShade}"/><ellipse cx="668" cy="614" rx="74" ry="82" fill="${mix(c('#8fcd96'), c('#aadfa4'), 0.3)}"/>` +
        `<use href="#cv-n" transform="translate(1350 790)scale(2.3)" fill="${c('#80bf92')}" stroke-width="1.1"/>` +
        `<path d="M1408 790C1412 750 1412 720 1408 690H1430C1428 720 1428 750 1434 790Z" fill="${trunkShade}"/>${crown(1420, 612, 80, 88, 9, c('#86c792'), c('#a4da9f'))}` +
        `<path d="M1860 784C1862 740 1860 700 1856 640H1886C1882 700 1882 740 1886 784Z" fill="${trunkShade}"/>${crown(1872, 500, 108, 124, 11, c('#7fc08c'), c('#9fd69a'))}`,
    );
  }

  // Hydrangea bushes behind the fence.
  {
    // Behind the glass a bush is a plain dome (all of them in `domes`) and has no flowers.
    let domes = '';
    const bush = (x, y, w, h, n, flower) => {
      let dots = '';
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.12 + 0.76 * tr());
        const k = 0.25 + tr() * 0.6;
        const cx = whole(x + Math.cos(a) * w * 0.5 * k);
        const dot = `<circle cx="${cx}" cy="${whole(y - Math.sin(a) * h * k - 6)}" r="${f(4 + tr() * 2.5)}"/>`;
        if (!veiled(cx, 7)) dots += dot;
      }
      const d = mound(x, y, w, h, n, tr);
      if (veiled(x, w / 2 + 6)) {
        domes += `M${x - w / 2} ${y}a${w / 2} ${h + 5} 0 0 1 ${w} 0Z`;
        return '';
      }
      return `<path d="${d}" fill="${gMid}"/>${dots && `<g fill="${flower}" stroke="none">${dots}</g>`}`;
    };
    const lav = c('#c9b9f2');
    const pink = c('#f7b3c6');
    const blue = c('#a9c9f0');
    const bushes = bush(118, 792, 130, 74, 7, lav) + bush(586, 792, 128, 78, 7, pink) + bush(760, 802, 110, 58, 6, blue) + bush(1238, 792, 130, 70, 7, lav) + bush(1120, 800, 100, 52, 6, pink) + bush(930, 792, 120, 50, 6, blue);
    o.push(`${bushes}<path d="${domes}" fill="${gMid}"/>`);
  }

  // White picket fence.
  {
    const white = c('#fffaf0');
    let pickets = '';
    for (let i = 0; i < 5; i++) pickets += `<path d="M${6 + i * 30} 0v-52q0-6 9-13q9 7 9 13v52z"/>`;
    D.push(`<g id="cv-fn" fill="${white}"><path d="M-2-46H152V-38H-2ZM-2-22H152V-14H-2Z" fill="${c('#eadfcd')}"/>${pickets}</g>`);
    let s = '';
    for (const x of [-34, 116, 266, 416, 566, 1178, 1328]) s += `<use href="#cv-fn" x="${x}" y="796"/>`;
    s += `<use href="#cv-fn" x="1884" y="790"/>`;
    D.push(
      `<g id="cv-bd" stroke-width="1.8"><path d="M-9-9L-18-14L-11-4Z"/><ellipse cy="-8" rx="9.5" ry="8"/><circle cx="7" cy="-15" r="6"/><path d="M12.5-16.5L18-15L12.5-12.5Z" fill="${c('#ffb37a')}"/><path d="M-5-8q5 5 9-1" fill="none" stroke-width="1.5"/><circle cx="9" cy="-16" r="1.1" fill="${ol}" stroke="none"/></g>`,
    );
    s += `<use href="#cv-bd" x="1403" y="733" fill="${c('#a9c9f0')}"/>`;
    // end posts with a ball on top
    for (const x of [724, 1170]) if (!veiled(x, 10)) s += `<path d="M${x - 8} 798V734H${x + 8}V798Z" fill="${white}"/><circle cx="${x}" cy="727" r="9" fill="${white}"/>`;
    o.push(s);
  }

  // ================= cherry tree =================
  {
    const p1 = c('#eea4ba');
    const p2 = c('#f5b9ca');
    const p3 = c('#fad0da');
    const p4 = c('#fde4ea');
    const cr = rng(12);
    const b = (x, y, rx, ry, n, fill) => `<path d="${blob(x, y, rx, ry, n, cr)}" fill="${fill}"/>`;
    // blossom tufts: little arcs and five-petal flowers
    let marks = '';
    let flowers = '';
    const spots = [[150, 306], [215, 356], [300, 292], [380, 336], [118, 428], [248, 446], [340, 410], [440, 428], [470, 492], [70, 518], [180, 506], [392, 538], [300, 506], [232, 272], [424, 296], [58, 448], [498, 420], [160, 384], [520, 520], [26, 520]];
    spots.forEach(([x, y], i) => {
      marks += `M${x - 13} ${y}a9 9 0 0 1 14-3a9 9 0 0 1 14 3`;
      if (i % 2 === 0) flowers += `<use href="#cv-f" x="${x + 26}" y="${y + 24}"/>`;
    });
    // A paper lantern, hung by its top; each one swings on a string of its own length.
    D.push(
      `<g id="cv-ln"><path d="M-13 6C-19 16-19 30-13 40H13C19 30 19 16 13 6Z"/>` +
        `<path d="M-7 6C-10 18-10 28-7 40M7 6C10 18 10 28 7 40M0 6V40" fill="none" stroke-width="1.3" opacity=".5"/>` +
        `<path d="M-9 0H9V6H-9ZM-8 40H8V45H-8Z" fill="${c('#8a6f66')}"/><path d="M0 45v9" stroke="${c('#f08c8c')}" stroke-width="3"/></g>`,
    );
    const lantern = (x, y, len, col, off) =>
      `<g transform="translate(${x} ${y})"><g>${animT('rotate', '-3.5;3.5;-3.5', 5.5, off)}<path d="M0 0V${len}"/><use href="#cv-ln" y="${len}" fill="${lamp(col)}"/></g></g>`;
    o.push(
      `${b(118, 505, 128, 96, 10, p1)}${b(412, 478, 134, 100, 11, p1)}` +
        // trunk and the low branch that carries the lanterns
        `<path d="M282 656C330 668 396 664 440 640C470 624 492 606 520 600L524 610C500 618 480 636 450 654C400 684 340 694 284 692Z" fill="${trunkCol}"/><path d="M468 628C478 612 482 600 480 586" fill="none" stroke-width="7"/><path d="M468 628C478 612 482 600 480 586" fill="none" stroke="${trunkCol}" stroke-width="3"/>${b(486, 574, 30, 21, 7, p3)}` +
        `<path d="M196 810C222 800 232 770 232 730L228 664C226 628 204 580 160 520L180 506C222 560 244 600 254 636C258 600 278 556 322 506L342 522C306 568 290 612 286 650C284 700 288 770 300 800L322 812Q258 820 196 810Z" fill="${trunkCol}"/>` +
        `<path d="M286 652C284 700 288 770 300 800L322 812Q292 819 264 817C270 770 268 720 270 680Z" fill="${trunkShade}" stroke="none"/>` +
        `<path d="M240 700q4 12 0 26M252 748q5 10 2 22M236 772q-2 10 2 18" fill="none" stroke-width="1.8" opacity=".6"/><ellipse cx="262" cy="712" rx="7" ry="10" fill="${trunkShade}" stroke-width="1.8"/>` +
        `${lantern(420, 656, 20, '#f9b29c', 0)}${lantern(498, 612, 44, '#fbd39a', 2.2)}` +
        `${b(255, 418, 196, 132, 14, p2)}${b(168, 330, 122, 82, 10, p3)}${b(348, 316, 126, 84, 10, p3)}${b(86, 432, 88, 62, 8, p3)}${b(448, 420, 94, 66, 9, p3)}` +
        `<g fill="${p4}" stroke="none" opacity=".8"><path d="${blob(150, 296, 66, 34, 7, cr)}"/><path d="${blob(332, 282, 68, 36, 7, cr)}"/><path d="${blob(74, 412, 46, 24, 6, cr)}"/><path d="${blob(440, 400, 50, 26, 6, cr)}"/><path d="${blob(254, 452, 70, 24, 7, cr)}"/></g>` +
        `<path d="${marks}" fill="none" stroke="${c('#e58fa8')}" stroke-width="2.2" opacity=".8"/><g fill="${c('#fff3f5')}" stroke-width="1.2">${flowers}</g></g>`,
    );
  }

  // ================= cottage =================
  {
    const wall = c('#fff3df');
    const wallSide = c('#f3e2ca');
    const wallShade = c('#e6d0b4');
    const roof = c('#f5a9bb');
    const roofDark = c('#e68da5');
    const roofLite = c('#fbc9d4');
    const trim = c('#fff9f0');
    const stone = c('#e3c7b1');
    const door = c('#a9d2e6');
    const wood = c('#d2a27e');
    const glass = lamp('#bfe3f2');
    const face = mix(c('#fffaf0'), '#fff2c6', clamp(L, 0, 1) * 0.85);
    const A = [92, -284];
    const R = [330, -276];
    const E1 = [206, -138];
    const E2 = [438, -134];
    let tiles = '';
    for (let k = 1; k <= 4; k++) {
      const u = k / 5;
      const sx = lerp(A[0], E1[0], u);
      const sy = lerp(A[1], E1[1], u);
      const n = 8;
      const dx = (lerp(R[0], E2[0], u) - sx) / n;
      const dy = (lerp(R[1], E2[1], u) - sy) / n;
      const rad = f(Math.hypot(dx, dy) * 0.62);
      const odd = k % 2;
      tiles += `M${f(sx + (odd ? dx / 2 : 0))} ${f(sy + (odd ? dy / 2 : 0))}` + `a${rad} ${rad} 0 0 0 ${f(dx)} ${f(dy)}`.repeat(odd ? n - 1 : n);
    }
    // One window, reused: frame, glass, bars, curtains, flower box.
    D.push(
      `<g id="cv-win"><path d="M-27 0V-40A27 27 0 0 1 27-40V0Z" fill="${trim}"/><path d="M-20-5V-40A20 20 0 0 1 20-40V-5Z" fill="${glass}"/>` +
        `<path d="M-20-40A20 20 0 0 1-2-59C-3-46-9-34-20-27ZM20-40A20 20 0 0 0 2-59C3-46 9-34 20-27Z" fill="${c('#f9c3d0')}" stroke-width="1.5"/>` +
        `<path d="M0-60V-5M-20-30H20" fill="none" stroke="${trim}" stroke-width="4"/>` +
        `<path d="M-32-2H32L29 13H-29Z" fill="${wood}"/><path d="${mound(0, -1, 58, 13, 5, tr)}" fill="${gLeaf}"/>` +
        `<g stroke="none"><circle cx="-18" cy="-8" r="4.5" fill="${c('#f79ab0')}"/><circle cx="-4" cy="-12" r="4.5" fill="${c('#ffe08a')}"/><circle cx="9" cy="-9" r="4.5" fill="${c('#f79ab0')}"/><circle cx="20" cy="-6" r="4" fill="${c('#fff8f2')}"/></g></g>`,
    );
    // The hands start at the moment the image is made and go round on their own,
    // so the clock keeps time with no new image each minute.
    const ch = clock ? Number(clock.hour) || 0 : hh;
    const cm = clock ? Number(clock.minute) || 0 : mm;
    const sec = Number(clock ? clock.second : second) || 0;
    const hourA = ((ch % 12) + cm / 60 + sec / 3600) * 30;
    const minA = (cm + sec / 60) * 6;
    const turn = (a, period) =>
      `<animateTransform attributeName="transform" type="rotate" from="${f(a)}" to="${f(a + 360)}" dur="${period}s" repeatCount="indefinite"/>`;
    // Hour marks: round dots, the quarters larger. Each is a speck of line with round ends.
    const ticks = ['', ''];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ticks[i % 3 ? 1 : 0] += `M${f(Math.sin(a) * 27)} ${f(-Math.cos(a) * 27)}h.1`;
    }
    // Smoke: a puff rises 74 and drifts 18 in six seconds, growing and fading, and there are
    // always three, two seconds apart. Each circle here takes a puff a third of the way and
    // starts again as the next one, so two seconds of movement is all that is written.
    const puff = (i, fade) =>
      `<circle cx="${318 + 6 * i}" cy="${f(-356 - (74 / 3) * i)}" r="9" opacity="0">${anim('r', `${f2(6 + (11 / 3) * i)};${f2(6 + (11 / 3) * (i + 1))}`, 2)}${anim('opacity', fade, 2)}</circle>`;
    o.push(
      `<g transform="translate(1478 800)"><g fill="${mix(cl, '#ffffff', 0.3)}">${animT('translate', '0 0;6 -24.67', 2)}${puff(0, '0;.47')}${puff(1, '.47;.7;.47')}${puff(2, '.47;0')}</g><g ${OUT}>` +
        // chimney behind the ridge
        `<path d="M300-262V-342H336V-262Z" fill="${c('#ebb9a6')}"/><path d="M294-354H342V-340H294Z" fill="${c('#f4cdbd')}"/><path d="M300-318H336M300-296H336M318-340V-318M309-318V-296M327-318V-296" stroke-width="1.4" opacity=".5"/>` +
        // walls
        `<path d="M184 0V-150L412-146V-12Z" fill="${wallSide}"/><path d="M0 0V-150L92-272L184-150V0Z" fill="${wall}"/>` +
        `<path d="M0-150L92-272L184-150V-128L92-248L0-128Z" fill="${wallShade}" stroke="none" opacity=".55"/><path d="M184-150L412-146V-128L184-131Z" fill="${wallShade}" stroke="none" opacity=".7"/>` +
        `<path d="M0-15H184V0H0Z" fill="${stone}"/><path d="M184-15L412-26V-12L184 0Z" fill="${stone}"/>` +
        `<path d="M30-15V0M70-15V0M150-15V0M228-17V-2M278-19V-5M330-22V-8M376-24V-10" stroke-width="1.4" opacity=".5"/>` +
        // roof slope with scalloped tiles
        `<path d="M92-284Q212-292 330-276Q396-212 438-134Q322-130 206-138Z" fill="${roof}"/>` +
        `<path d="M206-138Q322-130 438-134L428-152Q320-149 196-156Z" fill="${roofDark}" stroke="none" opacity=".55"/>` +
        `<path d="${tiles}" fill="none" stroke="${roofDark}" stroke-width="2.2"/>` +
        `<path d="M96-282Q212-290 328-274" fill="none" stroke="${roofLite}" stroke-width="5" opacity=".9"/>` +
        // dormer
        `<path d="M246-176V-204A27 27 0 0 1 300-204V-176Z" fill="${wall}"/><path d="M256-180V-204A17 17 0 0 1 290-204V-180Z" fill="${glass}"/><path d="M273-221V-180M256-200H290" stroke="${trim}" stroke-width="3.5"/>` +
        `<path d="M240-200A33 33 0 0 1 306-200" fill="none" stroke-width="13"/><path d="M240-200A33 33 0 0 1 306-200" fill="none" stroke="${roofLite}" stroke-width="8"/>` +
        // gable trim
        `<path d="M-24-134L92-284L208-134" fill="none" stroke-width="21"/><path d="M-24-134L92-284L208-134" fill="none" stroke="${trim}" stroke-width="16"/>` +
        // fairy lights under the gable trim
        `<path d="M7-158L81-254M177-158L103-254" stroke-width="1.4"/><g stroke-width="1.3">` +
        [
          ['#f79ab0', [20.4, -166.8], [76.1, -238.8], [145, -190.8]],
          ['#ffe08a', [39, -190.8], [107.9, -238.8], [163.6, -166.8]],
          ['#a9dcc9', [57.5, -214.8], [126.5, -214.8]],
        ]
          .map(([col, ...at]) => `<g fill="${lamp(col)}">${at.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.2"/>`).join('')}</g>`)
          .join('') +
        `</g>` +
        // side windows
        `<use href="#cv-win" x="252" y="-60"/><use href="#cv-win" x="346" y="-64"/>` +
        // door
        `<path d="M56 0V-70A36 36 0 0 1 128-70V0Z" fill="${trim}"/><path d="M63 0V-70A29 29 0 0 1 121-70V0Z" fill="${door}"/>` +
        `<path d="M82-96V0M102-96V0" stroke-width="1.4" opacity=".35"/><circle cx="92" cy="-68" r="11" fill="${glass}"/><path d="M92-79V-57M81-68H103" stroke-width="1.6"/><circle cx="112" cy="-38" r="3.4" fill="${c('#ffd86b')}"/>` +
        // steps
        `<path d="M38 10H146V26H38Z" fill="${c('#d9c6b2')}"/><path d="M48-2H136V12H48Z" fill="${c('#ecdccb')}"/>` +
        // wall lamp
        `<path d="M150-112h12v8" fill="none"/><path d="M155-104h14l-3 18h-8z" fill="${lamp('#ffe9b0')}"/><path d="M153-104h18"/>` +
        // flower pots by the door
        `<path d="M14-14H40L36 0H18Z" fill="${c('#e9a98f')}"/><path d="${mound(27, -13, 40, 22, 5, tr)}" fill="${gLeaf}"/><g stroke="none" fill="${c('#f79ab0')}"><circle cx="18" cy="-24" r="4.5"/><circle cx="29" cy="-31" r="4.5"/><circle cx="37" cy="-21" r="4.5"/></g>` +
        `<path d="${mound(216, -1, 54, 32, 6, tr)}" fill="${gMid}"/><g stroke="none" fill="${c('#ffe08a')}"><circle cx="204" cy="-15" r="4"/><circle cx="218" cy="-25" r="4"/><circle cx="229" cy="-13" r="4"/></g>` +
        `<use href="#cv-bd" transform="translate(222 -290)scale(-1 1)" fill="${c('#ffe59a')}"/>` +
        // climbing roses
        `<path d="M7-16C0-50 13-80 5-112C1-128 8-140 13-150" fill="none" stroke="${gStem}" stroke-width="3"/>` +
        `<g fill="${gLeaf}" stroke-width="1.5"><ellipse cx="-2" cy="-40" rx="7" ry="4" transform="rotate(-30 -2 -40)"/><ellipse cx="15" cy="-66" rx="7" ry="4" transform="rotate(25 15 -66)"/><ellipse cx="-1" cy="-96" rx="7" ry="4" transform="rotate(-25 -1 -96)"/><ellipse cx="16" cy="-128" rx="7" ry="4" transform="rotate(30 16 -128)"/></g>` +
        `<g fill="${c('#f79ab0')}" stroke-width="1.5"><circle cx="8" cy="-30" r="6"/><circle cx="3" cy="-58" r="6.5"/><circle cx="11" cy="-86" r="6"/><circle cx="3" cy="-118" r="6.5"/><circle cx="14" cy="-146" r="5.5"/></g>` +
        // mailbox
        `<g transform="translate(-14 104)"><path d="M-3.5 0V-40H3.5V0Z" fill="${wood}"/><rect x="-19" y="-64" width="38" height="25" rx="11" fill="${c('#f58d9f')}"/><path d="M-19-50H19" stroke-width="1.5" opacity=".5"/>` +
        `<path d="M0-52c-3-5-9-1-5 4l5 5l5-5c4-5-2-9-5-4z" fill="${c('#fff8f2')}" stroke-width="1.3"/><path d="M13-64v-13h9v7h-9" fill="${c('#ffe08a')}" stroke-width="1.8"/></g>` +
        // clock
        `<g transform="translate(92 -172)"><circle r="40" fill="${c('#f7b3c4')}"/><circle r="33" fill="${face}"/><path d="${ticks[0]}" stroke-width="5.6"/><path d="${ticks[1]}" stroke-width="3.2"/>` +
        `<path d="M0 5V-18" stroke-width="5.5" transform="rotate(${f(hourA)})">${turn(hourA, 43200)}</path><path d="M0 6V-27" stroke-width="3.2" transform="rotate(${f(minA)})">${turn(minA, 3600)}</path><circle r="4" fill="${c('#f58d9f')}" stroke-width="1.5"/>` +
        `<path d="M-9-44C-18-52-24-44-16-38ZM9-44C18-52 24-44 16-38Z" fill="${gLeaf}" stroke-width="1.8"/><circle cy="-43" r="5" fill="${c('#ffe08a')}" stroke-width="1.8"/></g>` +
        `</g>` +
        // night light around the lamp, windows and door
        (L > 0.02
          ? LIT + halo(162, -92, 74, L * 0.75) + halo(252, -90, 66, L * 0.6) + halo(346, -94, 66, L * 0.6) + halo(273, -196, 46, L * 0.55) + halo(92, -68, 34, L * 0.6) +
            `<ellipse cx="96" cy="34" rx="130" ry="32" opacity="${f2(L * 0.62)}"/><ellipse cx="300" cy="18" rx="170" ry="26" opacity="${f2(L * 0.45)}"/></g>`
          : '') +
        `</g>`,
    );
  }

  // ================= pond, stream, bridge =================
  {
    const sc = [c('#efe6da'), c('#dccfc2'), c('#e7d9c6')];
    const pr = rng(77);
    const stones = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + pr() * 0.08;
      const sn = Math.sin(a);
      const x = Math.cos(a) * 125;
      if (sn > 0.7 && x > -4 && x < 62) continue; // the stream leaves here
      const rx = 11.5 + 3.5 * sn + pr() * 3;
      stones.push([sn, `<ellipse cx="${whole(x)}" cy="${whole(sn * 43 + 2)}" rx="${whole(rx)}" ry="${whole(rx * 0.56)}" fill="${sc[i % 3]}"/>`]);
    }
    stones.sort((p, q) => p[0] - q[0]);
    const shine = L > 0.05 ? mix('#ffe9a8', GLOW, 0.5) : '#ffffff';
    // Lily pad, lotus flower and a lamp's light on the water: each drawn once.
    D.push(
      `<path id="cv-lp" d="M0 0L15-2.5A15 6 0 1 0 14 3.5Z" fill="${c('#8fd098')}"/>`,
      `<path id="cv-lo" d="M0 0C-9-3-10-11-6-14C-3-10 0-6 0 0ZM0 0C9-3 10-11 6-14C3-10 0-6 0 0ZM0-1C-4-8-2-16 0-19C2-16 4-8 0-1Z" fill="${bloom('#f9b4c6')}" stroke-width="1.6"/>`,
    );
    if (L > 0.05) D.push(`<g id="cv-rf" fill="${GLOW}" opacity="${f2(L * 0.6)}"><ellipse rx="15" ry="2.6"/><ellipse cx="2" cy="8" rx="11" ry="2.3"/><ellipse cx="-2" cy="16" rx="7" ry="2">${anim('rx', '7;10;7', 3.4)}</ellipse></g>`);
    // One outline for everything from here to the mushrooms.
    o.push(
      `<g ${OUT}><g transform="translate(1650 868)"><ellipse cy="1" rx="11" ry="4.5" fill="${c('#cfc1b0')}"/><path d="M-3.5 0V-48H3.5V0Z" fill="${c('#b98a6a')}"/>` +
        `<circle cy="-59" r="12" fill="${lamp('#fff3c4')}"/><path d="M-15-66Q0-84 15-66Z" fill="${c('#f5a9bb')}"/><path d="M-9-48H9"/></g>` +
      `<g transform="translate(1782 890)">` +
        `<path d="M8 30C14 60 6 92-8 130C-16 152-20 172-22 192H68C62 160 66 112 62 84C60 62 54 46 46 30Z" fill="url(#cv-wat)"/>` +
        `<path d="M-118 2C-120-22-66-40 4-40C70-40 120-24 118 0C116 26 62 40-2 40C-66 40-116 26-118 2Z" fill="url(#cv-wat)"/>` +
        `<g stroke="none">` +
        (L > 0.05 ? `<use href="#cv-rf" x="-52" y="-22"/><use href="#cv-rf" x="42" y="-24"/><use href="#cv-rf" x="-88" y="2"/>` : '') +
        `<g fill="none" stroke="${shine}" stroke-width="2.4" opacity=".7"><path d="M-84-6h22M-40 20h30M30 6h26M70-16h18M22 60q8 4 16 0M16 140q10 5 22 0"/>` +
        `<ellipse cx="-10" cy="-4" rx="10" ry="3">${anim('rx', '4;22', 4, 0)}${anim('ry', '1.4;7', 4, 0)}${anim('opacity', '.9;0', 4, 0)}</ellipse>` +
        `<ellipse cx="62" cy="14" rx="8" ry="3">${anim('rx', '4;18', 5, 2.2)}${anim('ry', '1.4;6', 5, 2.2)}${anim('opacity', '.9;0', 5, 2.2)}</ellipse></g></g>` +
        `<use href="#cv-lp" x="-66" y="-10"/><use href="#cv-lp" x="-24" y="16" transform="rotate(8)"/><use href="#cv-lp" x="54" y="-18"/><use href="#cv-lp" x="80" y="10"/><use href="#cv-lp" x="6" y="-24"/>` +
        `<use href="#cv-lo" x="-64" y="-12"/><use href="#cv-lo" x="56" y="-20"/><use href="#cv-lo" x="-20" y="14"/>` +
        // reeds at the back
        `<path d="M-96-22C-98-44-96-60-100-76M-88-24C-88-40-84-54-82-66M100-14C102-34 100-48 104-62" fill="none" stroke="${gStem}" stroke-width="3"/>` +
        `<g fill="${c('#b98a6a')}"><rect x="-104" y="-92" width="8" height="20" rx="4"/><rect x="-86" y="-82" width="8" height="18" rx="4"/><rect x="100" y="-78" width="8" height="19" rx="4"/></g>` +
        stones.map((s) => s[1]).join('') +
        `<ellipse cy="58" rx="9" ry="5" fill="${sc[0]}"/><ellipse cx="62" cy="54" rx="9" ry="5" fill="${sc[1]}"/><ellipse cx="-24" cy="158" rx="12" ry="6.5" fill="${sc[2]}"/><ellipse cx="74" cy="154" rx="12" ry="6.5" fill="${sc[0]}"/>` +
        `</g>`,
    );

    // arched wooden bridge over the stream
    const wood = c('#d9ab84');
    const woodD = c('#c08f6c');
    const post = (x, top, bottom) => `<path d="M${x - 5} ${bottom}V${top}Q${x} ${top - 6} ${x + 5} ${top}V${bottom}Z" fill="${woodD}"/>`;
    o.push(
      `<g transform="translate(1814 996)">` +
        `<ellipse cx="-74" cy="9" rx="15" ry="7" fill="${c('#e7d9c6')}"/><ellipse cx="74" cy="9" rx="15" ry="7" fill="${c('#dccfc2')}"/><path d="M-58-34Q0-60 58-34" fill="none" stroke-width="8"/><path d="M-58-34Q0-60 58-34" fill="none" stroke="${wood}" stroke-width="3.6"/>` +
        `<path d="M-72 2Q0-30 72 2L72 13Q0-19-72 13Z" fill="${wood}"/><path d="M-50-8v11M-26-15v11M0-17v11M26-15v11M50-8v11" stroke-width="1.5" opacity=".55"/>` +
        post(-60, -28, 4) + post(0, -42, -8) + post(60, -28, 4) +
        `<path d="M-66-24Q0-56 66-24" fill="none" stroke-width="10"/><path d="M-66-24Q0-56 66-24" fill="none" stroke="${wood}" stroke-width="5.4"/></g>`,
    );
  }

  // ================= paths =================
  D.push(
    `<g id="cv-s"><ellipse cy="5" rx="33" ry="10.5" fill="${c('#cfc1b0')}"/><ellipse rx="33" ry="10.5" fill="${c('#f0e6d7')}"/><path d="M-18-3q9-4 20-3" fill="none" stroke="${c('#ffffff')}" stroke-width="2.5" opacity=".75"/></g>`,
  );
  {
    let s = '';
    const r = rng(3);
    for (let x = 34; x < 1940; ) {
      const k = 0.78 + r() * 0.3;
      // leave the bridge clear
      if (x < 1722 || x > 1904) {
        const y = 992 + Math.round(r() * 6);
        if (!veiled(x, 34)) s += `<use href="#cv-s" transform="translate(${Math.round(x)} ${y})${sized(f(k))}"/>`;
      }
      x += 62 + k * 26 + r() * 10;
    }
    [[1570, 846, 0.62], [1561, 872, 0.72], [1550, 902, 0.82], [1539, 932, 0.92], [1530, 962, 1]].forEach(([x, y, k]) => {
      s += `<use href="#cv-s" transform="translate(${x} ${y})${sized(k)}"/>`;
    });
    o.push(s);
  }

  // ================= tea table =================
  {
    const pink = c('#f8bccb');
    const pinkD = c('#ee9cb1');
    const china = c('#fffaf5');
    const cushion = (x, a, b) => `<ellipse cx="${x}" cy="19" rx="40" ry="11.5" fill="${b}"/><ellipse cx="${x}" cy="12" rx="40" ry="11.5" fill="${a}"/><ellipse cx="${x}" cy="11" rx="24" ry="5.5" fill="${b}" stroke="none" opacity=".45"/>`;
    D.push(`<g id="cv-cu" fill="${china}"><ellipse cy="11" rx="12" ry="3.6"/><path d="M7 2c7-1 7 7 0 6" fill="none"/><path d="M-8 0h16c0 8-3 11-8 11s-8-3-8-11z"/></g>`);
    const cup = (x, y) => `<use href="#cv-cu" x="${x}" y="${y}"/>`;
    const steam = (x, y, off) => `<path d="M${x} ${y}q5-6 0-12t0-12" fill="none" stroke="${mix(cl, '#ffffff', 0.5)}" stroke-width="2.6" opacity="0">${anim('opacity', '0;.8;0', 3.6, off)}${animT('translate', '0 4;0 -8', 3.6, off)}</path>`;
    o.push(
      `<g transform="translate(430 866)">${cushion(-76, c('#cdbff0'), c('#b3a2e2'))}${cushion(76, c('#bfe6d3'), c('#9fd3bd'))}` +
        `<ellipse cy="5" rx="25" ry="7.5" fill="${china}"/><path d="M-7-32L-11 4H11L7-32Z" fill="${china}"/>` +
        `<ellipse cy="-32" rx="62" ry="17" fill="${pinkD}"/><ellipse cy="-39" rx="62" ry="17" fill="${pink}"/><ellipse cy="-39" rx="45" ry="11" fill="${c('#fff4f1')}" stroke-width="1.4" stroke-dasharray="1 5"/>` +
        cup(-40, -57) +
        // teapot
        `<path d="M9-56C18-56 20-66 27-73L32-68C27-62 25-50 12-48Z" fill="${china}"/><path d="M-20-66C-34-68-34-50-21-52" fill="none" stroke-width="4"/>` +
        `<ellipse cx="-4" cy="-59" rx="18" ry="15" fill="${china}"/><ellipse cx="-4" cy="-73" rx="10" ry="3.5" fill="${china}"/><circle cx="-4" cy="-78" r="3.2" fill="${pink}"/>` +
        `<g stroke="none" fill="${c('#f79ab0')}"><circle cx="-10" cy="-58" r="2.8"/><circle cx="-2" cy="-54" r="2.8"/><circle cx="4" cy="-60" r="2.8"/></g>` +
        // cake
        `<ellipse cx="36" cy="-44" rx="17" ry="5" fill="${china}"/><path d="M24-59v11a12 4 0 0 0 24 0v-11z" fill="${c('#fff1d8')}"/><path d="M24-53a12 4 0 0 0 24 0" fill="none" stroke="${c('#f79ab0')}" stroke-width="2.4"/>` +
        `<ellipse cx="36" cy="-59" rx="12" ry="4" fill="${china}"/><g fill="${c('#f2717f')}" stroke-width="1.3"><circle cx="30" cy="-61" r="3.2"/><circle cx="36" cy="-63" r="3.2"/><circle cx="42" cy="-61" r="3.2"/></g>` +
        cup(16, -47) + steam(30, -76, 0) + steam(-42, -60, 1.6) +
        `</g>`,
    );
  }

  // ================= little things on the lawn =================
  D.push(
    `<g id="cv-f"><circle cy="-6" r="4.6"/><circle cx="5.7" cy="-1.9" r="4.6"/><circle cx="3.5" cy="4.9" r="4.6"/><circle cx="-3.5" cy="4.9" r="4.6"/><circle cx="-5.7" cy="-1.9" r="4.6"/><circle r="3" fill="${c('#ffd86b')}" stroke="none"/></g>`,
    `<path id="cv-g" d="M-9 0C-10-9-14-16-19-20C-11-18-6-10-4 0ZM-3 0C-4-12-2-22 2-30C4-20 4-10 3 0ZM4 0C6-9 11-15 17-17C13-12 11-6 10 0Z" fill="${gDark}"/>`,
    `<g id="cv-mu"><path d="M-4 0C-5-6-4-10-3-12H3C4-10 5-6 4 0Z" fill="${c('#fff5e6')}"/><path d="M-12-11C-12-22 12-22 12-11Z" fill="${c('#f58d8d')}"/><g fill="${c('#fffaf5')}" stroke="none"><circle cx="-5" cy="-15" r="2"/><circle cx="3" cy="-17" r="2"/><circle cx="7" cy="-13" r="1.5"/></g></g>`,
  );
  {
    const r = rng(19);
    const cols = [c('#fff8f2'), c('#f9b4c6'), c('#ffe59a'), c('#cdbff0')];
    let tufts = '';
    const dots = ['', '', '', ''];
    for (let i = 0; i < 70; i++) {
      const x = Math.round(r() * 1920);
      const y = Math.round(826 + Math.pow(r(), 0.8) * 150);
      // keep clear of the tea table, pond and paths
      if ((x > 300 && x < 560 && y > 835 && y < 905) || (x > 1640 && y > 836 && y < 1000) || (x > 1500 && x < 1600 && y < 990) || y > 972) continue;
      if (veiled(x, 20)) continue; // under the glass the lawn is bare
      const s = f(0.55 + (y - 826) / 300);
      if (i % 3 === 0) tufts += `<use href="#cv-g" transform="translate(${x} ${y})${sized(s)}"/>`;
      else dots[i % 4] += `<use href="#cv-f" transform="translate(${x} ${y})${sized(s)}"/>`;
    }
    o.push(
      `${tufts}<g stroke-width="1">${dots.map((d, i) => `<g fill="${cols[i]}">${d}</g>`).join('')}</g>` +
        `<use href="#cv-mu" x="186" y="820"/><use href="#cv-mu" transform="translate(206 826)scale(.7)"/><use href="#cv-mu" transform="translate(318 822)scale(.85)"/></g>`,
    );
  }

  // Lantern light in the tree after dark,
  if (L > 0.02) {
    o.push(
      LIT + halo(420, 700, 110, L * 0.85) + halo(498, 684, 116, L * 0.85) + `<ellipse cx="452" cy="884" rx="200" ry="38" opacity="${f2(L * 0.5)}"/>` +
        // and around the garden lamp by the pond
        halo(1650, 809, 84, L * 0.8) + `<ellipse cx="1650" cy="874" rx="96" ry="22" opacity="${f2(L * 0.42)}"/></g>`,
    );
  }

  // Butterflies on a fine day.
  if (L < 0.3 && !Wx.rain) {
    // One pair of beating wings, flown along three ways.
    D.push(`<g id="cv-bf" stroke="${ol}" stroke-width="1.4">${animT('scale', '1 1;.25 1;1 1', 0.45)}<path d="M0 0C-10-14-18-6-11 1C-16 6-9 13 0 2ZM0 0C10-14 18-6 11 1C16 6 9 13 0 2Z"/></g>`);
    const fly = (x, y, col, dur, off) => `<use href="#cv-bf" x="${x}" y="${y}" fill="${col}">${animT('translate', '0 0;16 -18;34 -4;14 10;0 0', dur, off)}</use>`;
    o.push(fly(1474, 760, c('#ffe59a'), 9, 0) + fly(330, 742, c('#cdbff0'), 11, 3) + fly(1700, 982, c('#fff8f2'), 10, 5));
  }

  // ================= characters go here =================
  o.push(CAST);

  // ================= foreground flower bed =================
  D.push(
    `<g id="cv-t"><path d="M0 0C-1-16 1-30 0-42" fill="none" stroke="${gStem}" stroke-width="3.4"/><path d="M0-3C-12-6-17-20-15-30C-6-24-1-14 0-3ZM0-3C11-7 16-18 15-27C6-22 1-13 0-3Z" fill="${gLeaf}"/>` +
      `<path d="M-11-60C-14-50-9-40 0-40C9-40 14-50 11-60C8-56 6-56 4-59C2-62 0-64 0-64C0-64-2-62-4-59C-6-56-8-56-11-60Z"/><path d="M-4-58C-5-50-3-44 0-42C3-44 5-50 4-58C2-62 0-64 0-64C0-64-2-62-4-58Z" fill="#fff" fill-opacity=".32" stroke-width="1.4"/></g>`,
    `<g id="cv-o"><path d="M0 0C1-14-1-24 0-36" fill="none" stroke="${gStem}" stroke-width="3.4"/><path d="M0-8C-10-8-15-16-15-22C-8-22-2-16 0-8ZM0-12C9-12 14-19 14-25C7-25 2-19 0-12Z" fill="${gLeaf}"/>` +
      `<circle cy="-46" r="13"/><path d="M-7-47C-6-54 4-56 7-50C9-44 2-40-2-44C-4-47 0-50 2-48" fill="none" stroke-width="1.7" opacity=".6"/></g>`,
    `<g id="cv-d"><path d="M0 0C-1-14 1-24 0-34" fill="none" stroke="${gStem}" stroke-width="3.2"/><path d="M0-4C-9-6-13-14-12-20C-5-17-1-11 0-4Z" fill="${gLeaf}"/><use href="#cv-f" transform="translate(0 -40)scale(1.7)" stroke-width="1" fill="${bloom('#fff8f2')}"/></g>`,
    `<path id="cv-l" d="M0 0C-16-6-26-22-24-40C-10-32-2-16 0 0ZM0 0C4-18 14-32 28-36C26-20 14-6 0 0ZM0 0C-4-20 0-38 4-52C10-36 8-16 0 0Z" fill="${gMid}"/>`,
  );
  {
    const r = rng(8);
    const cols = ['#f8a5bb', '#fff8f2', '#f58d8d', '#ffe08a', '#cdb9f2', '#ffb98a'].map(bloom);
    const row = (scale, y0, yJ, stepSide, stepMid, lowRight) => {
      let s = '';
      for (let x = -10; x < 1940; ) {
        const side = x < 640 || x > 1340;
        const k = r();
        const y = (y0 + r() * yJ) / scale;
        const xs = x / scale;
        const low = lowRight && x > 1730 && x < 1890; // keep the bridge in view
        const kind = low ? (k < 0.5 ? 'g' : 'l') : k < 0.34 ? 't' : k < 0.52 ? 'o' : k < 0.66 ? 'd' : k < 0.84 ? 'g' : 'l';
        // tulips and roses come in every colour; the rest carry their own
        const tint = kind === 't' || kind === 'o' ? ` fill="${cols[Math.floor(r() * cols.length)]}"` : '';
        if (!veiled(x, 30 * scale)) s += `<use href="#cv-${kind}" x="${whole(xs)}" y="${whole(y)}"${tint}/>`;
        x += (side ? stepSide : stepMid) * (0.75 + r() * 0.5);
      }
      return `<g transform="scale(${scale})">${s}</g>`;
    };
    // Under the glass and the input box the bed is one low bank of leaves.
    o.push(`<g ${OUT}>${row(1.1, 1062, 10, 30, 52, true)}${row(1.5, 1098, 12, 40, 64, false)}<path d="M590 1090V1040Q960 1008 1330 1040V1090Z" fill="${gMid}" stroke="none"/></g>`);
  }

  // ================= drifting things =================
  const petalK = P.pet * (Wx.rain === 2 ? 0 : Wx.rain ? 0.35 : 1);
  if (petalK > 0.25) {
    const col = mix(c('#f9b9c9'), '#ffd0db', 0.4);
    const drift = [
      ['0 0;26 44;8 92;40 150', 8],
      ['0 0;-18 50;10 104;-8 160', 10],
      ['0 0;34 30;52 80;90 120', 7],
    ];
    // A petal drifts up to 90 to the right as it falls: those that stay behind the glass are left out.
    const seen = PETALS.slice(0, Math.round(PETALS.length * petalK)).map(([x, y], i) => [x, y, i % 3]).filter(([x]) => !veiled(x + 36, 62));
    drift.forEach(([path, dur], i) => {
      if (!seen.some((p) => p[2] === i)) return;
      D.push(
        `<path id="cv-p${i}" d="M0-6C5-5 6 2 0 7C-6 2-5-5 0-6Z" opacity="0">${animT('translate', path, dur, i * 2.3)}${animT('rotate', '0;200;360', dur / 2, i, ' additive="sum"')}${anim('opacity', '0;1;1;0', dur, i * 2.3, ' keyTimes="0;.12;.8;1"')}</path>`,
      );
    });
    o.push(`<g fill="${col}">${seen.map(([x, y, k]) => `<use href="#cv-p${k}" x="${x}" y="${y}"/>`).join('')}</g>`);
  }

  const flyK = P.ff * (Wx.rain === 2 ? 0 : Wx.rain ? 0.4 : 1);
  if (flyK > 0.05) {
    D.push(radial('cv-gf', '#eaff9a', 0.9, 0.28));
    const moves = [
      ['0 0;16 -12;6 -26;-12 -10;0 0', 9, 2.9],
      ['0 0;-14 -8;-22 -22;-6 -14;0 0', 11, 3.7],
      ['0 0;10 8;22 -4;8 -14;0 0', 7.5, 2.3],
      ['0 0;-8 -16;8 -28;14 -12;0 0', 12.5, 4.3],
      ['0 0;18 -4;26 -18;8 -20;0 0', 10, 3.1],
    ];
    D.push(`<g id="cv-ff"><circle r="14" fill="url(#cv-gf)"/><circle r="2.9" fill="#f7ffbe"/></g>`);
    moves.forEach(([path, dur, blink], i) => {
      D.push(`<use id="cv-f${i}" href="#cv-ff">${animT('translate', path, dur, i * 1.7)}${anim('opacity', '.15;1;.45;1;.15', blink, i * 0.9)}</use>`);
    });
    const n = Math.round(FLIES.length * flyK);
    o.push(FLIES.slice(0, n).map(([x, y], i) => (veiled(x, 42) ? '' : `<use href="#cv-f${i % 5}" x="${x}" y="${y}"/>`)).join(''));
  }

  // ================= rain and lightning =================
  if (Wx.rain) {
    const heavy = Wx.rain > 1;
    const r = rng(9);
    let d = '';
    for (let i = 0; i < (heavy ? 34 : 26); i++) d += `M${Math.round(r() * 480)} ${Math.round(r() * 480)}l-7 26`;
    D.push(`<path id="cv-rn" d="${d}"/>`);
    // One sheet of rain, wide and tall enough to fall across the view, shared by both layers.
    let row = '';
    for (let i = 0; i < 6; i++) row += `<use href="#cv-rn" x="${i * 480}"/>`;
    let tile = '';
    for (let j = 0; j < 4; j++) tile += `<use href="#cv-rw" x="${-j * 129}" y="${j * 480 - 480}"/>`;
    D.push(`<g id="cv-rw">${row}</g>`, `<g id="cv-rt">${tile}</g>`);
    const col = mix(c('#eef5ff'), '#cfe0ff', 0.6);
    // Each line faded on its own (stroke-opacity), not the sheet as a whole: a faded
    // group this big over moving rain stops the backdrop from moving in the app.
    const layer = (width, op, dur, tf) => `<g stroke="${col}" stroke-width="${width}" stroke-opacity="${z(op)}"${tf ? ` transform="${tf}"` : ''}><use href="#cv-rt">${animT('translate', '0 0;-129 480', dur)}</use></g>`;
    o.push(heavy ? layer(2, 0.4, 0.62, 'skewX(-9)') + layer(2.6, 0.55, 0.44, 'translate(-260 -120)scale(1.4)skewX(-9)') : layer(1.3, 0.38, 0.9, '') + layer(1.6, 0.5, 0.66, 'translate(-260 -120)scale(1.4)'));
    // rings where drops land
    D.push(`<ellipse id="cv-rp" rx="2" ry=".8" fill="none" stroke="${col}" stroke-width="1.6" opacity="0">${anim('rx', '2;13', 1.3)}${anim('ry', '.8;4.6', 1.3)}${anim('opacity', '.9;0', 1.3)}</ellipse>`);
    o.push([[1730, 900], [1840, 916], [1560, 1004], [330, 1000], [470, 940], [200, 930], [1660, 960], [1450, 880], [560, 1006], [1800, 1070], [120, 1010], [1900, 990]].map(([x, y], i) => `<use href="#cv-rp" x="${x + (i % 2 ? 14 : 0)}" y="${y + (i % 2 ? 6 : 0)}"/>`).join(''));
    if (heavy) {
      // Bolts only, each with a bright rim: a big area lighting up at once (a whole-view
      // flash, a glow round a bolt, the clouds brightening) stops the backdrop in the app.
      const at = ' keyTimes="0;.88;.89;.91;.92;.96;1"';
      const bolt = (d, dur, off) =>
        `<path d="${d}" fill="none" stroke="#fffbe2" stroke-width="16" stroke-linejoin="round" stroke-opacity="0">${anim('stroke-opacity', '0;0;.5;.08;.36;0;0', dur, off, at)}</path>` +
        `<path d="${d}" fill="#fff8d2" stroke="#fffdf0" stroke-width="5" stroke-linejoin="round" fill-opacity="0" stroke-opacity="0">${anim('fill-opacity', '0;0;1;.15;.8;0;0', dur, off, at)}${anim('stroke-opacity', '0;0;.9;.1;.7;0;0', dur, off, at)}</path>`;
      o.push(
        bolt('M1552 90L1510 236H1532L1488 380H1508L1464 506L1526 356H1504L1550 214H1528L1568 90Z', 9, 0) +
          bolt('M606 120L574 226H592L554 340L606 216H588L622 120Z', 13, 5),
      );
    }
  }

  // The cast's own drawing goes in as it came; only the scene's paths are packed.
  const at = o.indexOf(CAST);
  const back = pack(o.slice(0, at).join(''));
  const front = pack(o.slice(at + 1).join(''));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><defs>${pack(D.join(''))}</defs><g stroke-linejoin="round" stroke-linecap="round">${back}${String(actors || '')}${front}</g></svg>`;
}
