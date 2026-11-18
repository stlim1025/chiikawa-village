// The village's job board: the session's subagents as jobs, which friend goes out to
// the weeding field for each, and what the board and the field show at a moment.
// Pure: every function hands back new values and leaves its inputs as they were.
// Times are epoch milliseconds.

// Who goes to work first, of those on stage and not busy already.
export const WORK_ORDER = ["chiikawa", "hachiware", "usagi", "kurimanju", "momonga", "rakko"];
export const MAX_WORKERS = 3; // the field holds three
export const MAX_NOTES = 4; // pins on the board
// How long a friend stays out after its job ends: the line said, the walk back home.
export const RETURN_MS = 40000;
// A finished note hangs stamped until its friend is home (one picture carries both),
// lies on the grass a while, then goes.
export const DROP_MS = RETURN_MS;
export const GONE_MS = 120000;

export const ENDED = new Set(["completed", "failed", "killed"]);
const WAITING = new Set(["waiting", "idle"]);
const HISTORY = 24;

// The mark on a note for what sort of job it is.
export function kindOf(type) {
  const name = String(type ?? "");
  if (name === "Explore") return "search";
  if (name === "general-purpose") return "write";
  if (/review/i.test(name)) return "review";
  return "other";
}

// Whether a friend is still out on this job at `now`: working, or not yet home.
const isOut = (job, now) => job.worker !== null && (job.endedAt === null || now < job.endedAt + RETURN_MS);

export function addJob(jobs, { id, type, task, startedAt, status, now }, onStage) {
  // One note per agent: seeded at session start and spawned again under the same id.
  if (jobs.some((job) => job.id === id)) {
    return jobs;
  }
  const out = jobs.filter((job) => isOut(job, now));
  const busy = new Set(out.map((job) => job.worker));
  const taken = new Set(out.map((job) => job.slot));
  const free = out.length < MAX_WORKERS ? WORK_ORDER.find((who) => onStage.includes(who) && !busy.has(who)) : undefined;
  const slot = free ? [0, 1, 2].find((i) => !taken.has(i)) : undefined;
  const job = {
    id,
    type,
    task,
    startedAt,
    endedAt: null,
    status,
    statusAt: now,
    tool: "",
    detail: "",
    history: [],
    toolCount: 0,
    isAnswered: false,
    worker: free ?? null,
    slot: slot ?? null,
  };
  return [...jobs, job];
}

export function noteTool(jobs, id, tool, detail) {
  return jobs.map((job) =>
    job.id === id && job.endedAt === null
      ? { ...job, tool, detail, history: [...job.history, tool].slice(-HISTORY), toolCount: job.toolCount + 1 }
      : job,
  );
}

export function noteAnswered(jobs, id) {
  return jobs.map((job) => (job.id === id ? { ...job, isAnswered: true } : job));
}

// Brings the jobs up to the engine's list: an id the list doesn't name (a workflow's
// agent) ends once its loop answered. Jobs gone long enough are let go.
export function settle(jobs, list, now) {
  const ended = [];
  const kept = [];
  for (const job of jobs) {
    if (job.endedAt !== null) {
      if (now < job.endedAt + GONE_MS) kept.push(job);
      continue;
    }
    const info = list.find((one) => one.id === job.id);
    const status = info ? info.status : job.isAnswered ? "completed" : job.status;
    let next = status === job.status ? job : { ...job, status, statusAt: now };
    if (ENDED.has(status)) {
      next = { ...next, endedAt: now };
      ended.push(next);
    }
    kept.push(next);
  }
  return { jobs: kept, ended };
}

const markOf = (status) =>
  status === "completed" ? "done" : ENDED.has(status) ? "fail" : WAITING.has(status) ? "wait" : "run";
const stateOf = (status) => ({ run: "work", wait: "wait", done: "done", fail: "fail" })[markOf(status)];

// What the board and the field show at `now`.
export function boardOf(jobs, now) {
  const live = jobs.filter((job) => job.endedAt === null || now < job.endedAt + GONE_MS);
  const notes = live.map((job) => ({
    who: job.worker,
    kind: kindOf(job.type),
    minutes: job.startedAt === null ? null : Math.max(0, Math.floor(((job.endedAt ?? now) - job.startedAt) / 60000)),
    mark: markOf(job.status),
    isFallen: job.endedAt !== null && now >= job.endedAt + DROP_MS,
  }));
  const pinned = notes.filter((note) => !note.isFallen);
  const fallen = notes.filter((note) => note.isFallen);
  const workers = live
    .filter((job) => isOut(job, now))
    .map((job) => {
      const state = stateOf(job.status);
      const since = state === "work" ? job.startedAt ?? -Infinity : state === "wait" ? job.statusAt : job.endedAt;
      return { who: job.worker, slot: job.slot, state, startedAt: job.startedAt, since };
    });
  return {
    notes: [...pinned.slice(0, MAX_NOTES), ...fallen.slice(-2)],
    extra: Math.max(0, pinned.length - MAX_NOTES),
    workers,
  };
}

// When the next running note's minute count turns over, or null if none counts.
export function nextMinuteAt(jobs, now) {
  let next = null;
  for (const job of jobs) {
    if (job.endedAt !== null || job.startedAt === null) continue;
    const at = job.startedAt + (Math.floor((now - job.startedAt) / 60000) + 1) * 60000;
    if (next === null || at < next) next = at;
  }
  return next;
}

// What a new picture depends on: who, which mark, fallen or not, and the field.
// The minutes are left out, so a minute passing makes no picture of its own.
export function boardKey(board) {
  const notes = board.notes.map((n) => `${n.who ?? "-"}.${n.kind}.${n.mark}.${n.isFallen ? 1 : 0}`).join(",");
  const field = board.workers.map((w) => `${w.who}.${w.slot}.${w.state}`).join(",");
  return `${notes}|${board.extra}|${field}`;
}
