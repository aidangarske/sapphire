import { loadState, patchState } from "../platform/wsState.ts";
import { clearDoneColumn } from "./boards.ts";
import { dateStr } from "../core/journal.ts";

// Empty the Daily board's Done column at most once per calendar day. Idempotent
// via lastDoneClear so the TUI loop, `sapphire watch`, and a cron invocation all
// share one guard. `force` skips the once-a-day gate (explicit `board clear-done`).
export function runNightlyClear(ws: string, force = false): { cleared: boolean; removed: number } {
  const today = dateStr(Date.now());
  const state = loadState(ws);
  if (!force && state.lastDoneClear === today) return { cleared: false, removed: 0 };
  const removed = clearDoneColumn(ws);
  patchState(ws, { lastDoneClear: today });
  return { cleared: true, removed };
}
