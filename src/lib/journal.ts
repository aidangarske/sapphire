export type ActAction = "done" | "blocked" | "inprogress";

export interface Activity {
  ts: number;
  date: string; // YYYY-MM-DD
  action: ActAction;
  title: string;
  note?: string;
  pr?: string; // linked PR url, if the task has one
}

const KEY = "sapphire.activity";
const NAME_KEY = "sapphire.dailyNote";
export const DEFAULT_DAILY_NOTE = "Daily Notes";

export function getDailyNoteName(): string {
  return localStorage.getItem(NAME_KEY) || DEFAULT_DAILY_NOTE;
}
export function setDailyNoteName(n: string) {
  localStorage.setItem(NAME_KEY, n.trim() || DEFAULT_DAILY_NOTE);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function load(): Activity[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(a: Activity[]) {
  localStorage.setItem(KEY, JSON.stringify(a));
}

const clean = (t: string) =>
  t
    .replace(/#[\w-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function logActivity(action: ActAction, title: string, note?: string, pr?: string) {
  const ts = Date.now();
  const date = dateStr(ts);
  const t = clean(title);
  if (!t) return;
  const all = load().filter((a) => !(a.date === date && a.action === action && a.title === t));
  all.push({
    ts,
    date,
    action,
    title: t,
    note: note ? clean(note) : undefined,
    pr: pr || undefined,
  });
  save(all);
}

export function datesWithActivity(): string[] {
  return Array.from(new Set(load().map((a) => a.date))).sort();
}

export function clearDate(date: string) {
  save(load().filter((a) => a.date !== date));
}

export function buildDaily(date: string): string {
  const acts = load().filter((a) => a.date === date);
  if (acts.length === 0) return "";
  const done = acts.filter((a) => a.action === "done");
  const inprog = acts.filter((a) => a.action === "inprogress");
  const blocked = acts.filter((a) => a.action === "blocked");

  const d = new Date(`${date}T12:00:00`);
  const heading = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const link = (a: Activity) => (a.pr && !a.title.includes(a.pr) ? ` ${a.pr}` : "");
  const entry = (a: Activity) => `- ${a.title}${link(a)}${a.note ? `: ${a.note}` : ""}`;
  let md = `\n## ${heading}\n`;
  if (done.length) {
    md += `\n**Done**\n` + done.map(entry).join("\n") + "\n";
  }
  if (inprog.length) {
    md += `\n**In progress**\n` + inprog.map(entry).join("\n") + "\n";
  }
  if (blocked.length) {
    md += `\n**Blocked**\n` + blocked.map(entry).join("\n") + "\n";
  }
  return md;
}
