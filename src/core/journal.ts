import type { Activity, ActAction } from "./types.ts";

export const DEFAULT_DAILY_NOTE = "Daily Notes";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const clean = (t: string) =>
  t
    .replace(/#[\w-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Append `entry` to `all`, deduping same-day/same-action/same-title, and return
// the new list. Pure so both the CLI and TUI share the exact journal semantics.
export function addActivity(
  all: Activity[],
  action: ActAction,
  title: string,
  ts: number,
  note?: string,
  pr?: string,
): Activity[] {
  const date = dateStr(ts);
  const t = clean(title);
  if (!t) return all;
  const kept = all.filter((a) => !(a.date === date && a.action === action && a.title === t));
  kept.push({ ts, date, action, title: t, note: note ? clean(note) : undefined, pr: pr || undefined });
  return kept;
}

export function datesWithActivity(all: Activity[]): string[] {
  return Array.from(new Set(all.map((a) => a.date))).sort();
}

export function buildDaily(all: Activity[], date: string): string {
  const acts = all.filter((a) => a.date === date);
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
  if (done.length) md += `\n**Done**\n` + done.map(entry).join("\n") + "\n";
  if (inprog.length) md += `\n**In progress**\n` + inprog.map(entry).join("\n") + "\n";
  if (blocked.length) md += `\n**Blocked**\n` + blocked.map(entry).join("\n") + "\n";
  return md;
}
