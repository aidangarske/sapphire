import { statePath, activityPath } from "../core/workspacePaths.ts";
import { readTextIfExists, writeText } from "./fs.ts";
import { DEFAULT_DAILY_NOTE } from "../core/journal.ts";
import type { Activity } from "../core/types.ts";

export interface WsState {
  activeBoard: string;
  dailyNoteName: string;
  lastDoneClear?: string;
  autoTodoSeen: string[];
}

const DEFAULTS: WsState = {
  activeBoard: "board.md",
  dailyNoteName: DEFAULT_DAILY_NOTE,
  autoTodoSeen: [],
};

export function loadState(ws: string): WsState {
  const raw = readTextIfExists(statePath(ws));
  if (!raw) return { ...DEFAULTS, autoTodoSeen: [] };
  try {
    const j = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...j,
      autoTodoSeen: Array.isArray(j?.autoTodoSeen) ? j.autoTodoSeen : [],
    };
  } catch {
    return { ...DEFAULTS, autoTodoSeen: [] };
  }
}

export function saveState(ws: string, state: WsState): void {
  writeText(statePath(ws), JSON.stringify(state, null, 2) + "\n");
}

export function patchState(ws: string, patch: Partial<WsState>): WsState {
  const next = { ...loadState(ws), ...patch };
  saveState(ws, next);
  return next;
}

export function loadActivity(ws: string): Activity[] {
  const raw = readTextIfExists(activityPath(ws));
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export function saveActivity(ws: string, all: Activity[]): void {
  writeText(activityPath(ws), JSON.stringify(all, null, 2) + "\n");
}
