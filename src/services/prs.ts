import * as gh from "../platform/gh.ts";
import { loadPrCache, savePrCache } from "../platform/cache.ts";
import { loadState, patchState } from "../platform/wsState.ts";
import { readBoard, writeBoard, createTaskFromPr } from "./boards.ts";
import { ensureColumns, addTask, tasksIn } from "../core/board.ts";
import { plannedTodoAdds, isMine } from "../core/github/todoSync.ts";
import type { Pr } from "../core/github/types.ts";

export { createTaskFromPr };

// Fetch PRs from gh and refresh the global cache. Throws gh.GhError on
// missing/unauthenticated gh so callers can render the right hint.
export async function fetchPrs(): Promise<Pr[]> {
  const prs = await gh.pullRequests();
  const cache = loadPrCache();
  cache.prs = prs;
  cache.fetchedAt = Date.now();
  try {
    cache.account = await gh.account();
  } catch {
    /* keep previous account on transient error */
  }
  savePrCache(cache);
  return prs;
}

export function cachedPrs(): Pr[] {
  // Backfill fields absent from caches written before author/assignees existed.
  return (loadPrCache().prs ?? []).map((p) => ({
    ...p,
    author: p.author ?? "",
    assignees: p.assignees ?? [],
  }));
}

export function cachedLogin(): string {
  return loadPrCache().account?.login ?? "";
}

// Add PRs you authored, PRs assigned to you, and PRs where your review is
// requested to the Daily board's Todo column, once each. The seen-set (in
// workspace state) means deleting the task won't make it reappear.
export async function syncCreatedPrsToTodo(ws: string): Promise<number> {
  let prs: Pr[];
  try {
    prs = await fetchPrs();
  } catch {
    return 0;
  }
  const state = loadState(ws);
  const seen = new Set(state.autoTodoSeen);
  const board = ensureColumns(readBoard(ws, "board.md"));
  const onBoard = new Set<string>();
  for (const col of board.columns) for (const t of tasksIn(col)) if (t.pr) onBoard.add(t.pr);

  const adds = plannedTodoAdds(prs, seen, onBoard);
  for (const a of adds) {
    addTask(board, "Todo", a.title, { pr: a.url });
    seen.add(a.url);
  }
  // Mark every PR that concerns you seen so removing a task won't resurrect it.
  for (const p of prs) if (isMine(p)) seen.add(p.url);
  patchState(ws, { autoTodoSeen: [...seen] });
  if (adds.length > 0) writeBoard(ws, "board.md", board);
  return adds.length;
}
