import * as fsx from "../platform/fs.ts";
import { tasksDir, boardFilePath, BOARD_TEMPLATE } from "../core/workspacePaths.ts";
import {
  parseBoard,
  serializeBoard,
  ensureColumns,
  addTask,
  tasksIn,
  type Board,
} from "../core/board.ts";
import { loadState, patchState } from "../platform/wsState.ts";
import type { BoardFile } from "../core/types.ts";
import type { Pr } from "../core/github/types.ts";

export function getActiveBoard(ws: string): string {
  return loadState(ws).activeBoard;
}

export function setActiveBoard(ws: string, file: string): void {
  patchState(ws, { activeBoard: file });
}

export function listBoards(ws: string): BoardFile[] {
  const entries = fsx.listNotes(tasksDir(ws));
  const boards = entries.map((e) => ({
    name: e.name.replace(/\.md$/, ""),
    path: e.path,
    isDefault: e.name === "board.md",
  }));
  boards.sort((a, b) =>
    a.isDefault ? -1 : b.isDefault ? 1 : a.name.localeCompare(b.name),
  );
  return boards;
}

export function readBoard(ws: string, file: string): Board {
  const raw = fsx.readTextIfExists(boardFilePath(ws, file)) ?? BOARD_TEMPLATE;
  return parseBoard(raw);
}

export function writeBoard(ws: string, file: string, board: Board): void {
  fsx.writeNote(boardFilePath(ws, file), serializeBoard(board));
}

export function createBoard(ws: string, name: string): string {
  const path = fsx.createNote(tasksDir(ws), name || "Board");
  fsx.writeNote(path, BOARD_TEMPLATE);
  return path;
}

export function renameBoard(ws: string, oldPath: string, newName: string): string {
  const safe = newName.trim().replace(/[/\\:]/g, "-") || "Board";
  const newPath = boardFilePath(ws, `${safe}.md`);
  if (newPath === oldPath) return oldPath;
  fsx.renameNote(oldPath, newPath);
  return newPath;
}

export function deleteBoard(path: string): void {
  fsx.deleteNote(path);
}

// Empty the Done column of a board (default: the main board). Returns removed count.
export function clearDoneColumn(ws: string, file = "board.md"): number {
  const raw = fsx.readTextIfExists(boardFilePath(ws, file));
  if (raw == null) return 0;
  const board = parseBoard(raw);
  const done = board.columns.find((c) => c.key === "Done");
  if (!done) return 0;
  const removed = tasksIn(done).length;
  if (removed === 0) return 0;
  done.nodes = [{ kind: "raw", text: "\n" }];
  writeBoard(ws, file, board);
  return removed;
}

export function createTaskFromPr(ws: string, pr: Pr): void {
  const file = "board.md";
  const board = ensureColumns(readBoard(ws, file));
  const repoName = pr.repo.split("/").pop() ?? pr.repo;
  const title = pr.review_requested_of_me
    ? `Review: ${pr.title} #${repoName} #review`
    : `${pr.title} #${repoName}`;
  if (!addTask(board, "Todo", title, { pr: pr.url })) throw new Error("Todo column missing");
  writeBoard(ws, file, board);
}
