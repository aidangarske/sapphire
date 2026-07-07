import { loadActivity, saveActivity, loadState } from "../platform/wsState.ts";
import { addActivity, buildDaily, datesWithActivity, dateStr } from "../core/journal.ts";
import { appendDailyNote } from "./notes.ts";
import type { ActAction } from "../core/types.ts";

export function logActivity(
  ws: string,
  action: ActAction,
  title: string,
  note?: string,
  pr?: string,
): void {
  const all = loadActivity(ws);
  const next = addActivity(all, action, title, Date.now(), note, pr);
  saveActivity(ws, next);
}

export function loggedDates(ws: string): string[] {
  return datesWithActivity(loadActivity(ws));
}

// Build the daily summary for `date`, append it to the workspace's daily note,
// then drop that day's activity so re-running doesn't duplicate. Returns the
// appended markdown (empty string when there was nothing to log).
export function flushDailyToNote(ws: string, date = dateStr(Date.now())): string {
  const all = loadActivity(ws);
  const md = buildDaily(all, date);
  if (!md) return "";
  const noteName = loadState(ws).dailyNoteName;
  appendDailyNote(ws, noteName, md);
  saveActivity(ws, all.filter((a) => a.date !== date));
  return md;
}
