import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { addTask, ensureColumns, parseBoard, serializeBoard, tasksIn } from "./taskParser";
import { fetchPrs } from "./github";

export interface NoteEntry {
  name: string;
  path: string;
  modified: number;
}

export interface OrderedNote extends NoteEntry {
  id: number;
}

export interface SearchHit {
  name: string;
  path: string;
  line: number;
  snippet: string;
  title_match: boolean;
}

export interface NotesIndex {
  nextId: number;
  order: string[];
  ids: Record<string, number>;
}

const WS_KEY = "sapphire.workspace";

export function getWorkspace(): string | null {
  return localStorage.getItem(WS_KEY);
}

export function setWorkspace(path: string) {
  localStorage.setItem(WS_KEY, path);
}

export const notesDir = (ws: string) => `${ws}/notes`;
export const tasksDir = (ws: string) => `${ws}/tasks`;
export const boardPath = (ws: string) => `${ws}/tasks/board.md`;
const indexPath = (ws: string) => `${ws}/config/notes-index.json`;

const BOARD_TEMPLATE = "## Todo\n\n## In Progress\n\n## Blocked\n\n## Done\n\n## Want To Do\n";
const ACTIVE_BOARD_KEY = "sapphire.activeBoard";

export interface BoardFile {
  name: string; // display name (filename without .md)
  path: string;
  isDefault: boolean; // the primary "Daily" board (board.md)
}

export const getActiveBoardFile = () => localStorage.getItem(ACTIVE_BOARD_KEY) ?? "board.md";
export const setActiveBoardFile = (f: string) => localStorage.setItem(ACTIVE_BOARD_KEY, f);

export async function listBoards(ws: string): Promise<BoardFile[]> {
  const entries = await invoke<NoteEntry[]>("list_notes", { dir: tasksDir(ws) });
  const boards = entries.map((e) => ({
    name: e.name.replace(/\.md$/, ""),
    path: e.path,
    isDefault: e.name === "board.md",
  }));
  // primary board first, then the rest oldest-to-newest by name
  boards.sort((a, b) => (a.isDefault ? -1 : b.isDefault ? 1 : a.name.localeCompare(b.name)));
  return boards;
}

export async function createBoard(ws: string, name: string): Promise<string> {
  const path = await invoke<string>("create_note", { dir: tasksDir(ws), title: name || "Board" });
  await writeNote(path, BOARD_TEMPLATE);
  return path;
}

export async function renameBoard(ws: string, oldPath: string, newName: string): Promise<string> {
  const safe = newName.trim().replace(/[\/\\:]/g, "-") || "Board";
  const newPath = `${tasksDir(ws)}/${safe}.md`;
  if (newPath === oldPath) return oldPath;
  await invoke("rename_note", { from: oldPath, to: newPath });
  return newPath;
}

export function deleteBoard(path: string): Promise<void> {
  return invoke("delete_note", { path });
}

export async function pickWorkspace(): Promise<string | null> {
  const picked = await open({
    directory: true,
    multiple: false,
    title: "Choose a Sapphire workspace folder",
  });
  if (typeof picked !== "string") return null;
  await invoke("ensure_workspace", { dir: picked });
  setWorkspace(picked);
  return picked;
}

export async function initWorkspace(ws: string): Promise<void> {
  await invoke("ensure_workspace", { dir: ws });
}

export function listNotes(ws: string): Promise<NoteEntry[]> {
  return invoke("list_notes", { dir: notesDir(ws) });
}

export function readNote(path: string): Promise<string> {
  return invoke("read_note", { path });
}

export function writeNote(path: string, contents: string): Promise<void> {
  return invoke("write_note", { path, contents });
}

export function deleteNote(path: string): Promise<void> {
  return invoke("delete_note", { path });
}

export function searchNotes(ws: string, query: string): Promise<SearchHit[]> {
  return invoke("search_notes", { dir: notesDir(ws), query });
}

function isPosInt(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0;
}

async function loadIndex(ws: string): Promise<NotesIndex> {
  const fallback: NotesIndex = { nextId: 1, order: [], ids: {} };
  try {
    const j = JSON.parse(await readNote(indexPath(ws)));
    const order =
      Array.isArray(j?.order) && j.order.every((s: unknown) => typeof s === "string")
        ? (j.order as string[])
        : [];
    const ids: Record<string, number> = {};
    if (j?.ids && typeof j.ids === "object" && !Array.isArray(j.ids)) {
      for (const [k, v] of Object.entries(j.ids)) if (isPosInt(v)) ids[k] = v;
    }
    return { nextId: isPosInt(j?.nextId) ? j.nextId : 1, order, ids };
  } catch {
    return fallback;
  }
}

async function saveIndex(ws: string, idx: NotesIndex): Promise<void> {
  await writeNote(indexPath(ws), JSON.stringify(idx, null, 2));
}

export async function listOrderedNotes(ws: string): Promise<OrderedNote[]> {
  const entries = await listNotes(ws);
  const idx = await loadIndex(ws);
  const present = new Set(entries.map((e) => e.name));
  let changed = false;

  for (const e of entries) {
    if (idx.ids[e.name] == null) {
      idx.ids[e.name] = idx.nextId++;
      changed = true;
    }
    if (!idx.order.includes(e.name)) {
      idx.order.push(e.name);
      changed = true;
    }
  }
  const trimmed = idx.order.filter((n) => present.has(n));
  if (trimmed.length !== idx.order.length) {
    idx.order = trimmed;
    changed = true;
  }
  for (const name of Object.keys(idx.ids)) {
    if (!present.has(name)) {
      delete idx.ids[name];
      changed = true;
    }
  }
  if (changed) await saveIndex(ws, idx);

  const byName = new Map(entries.map((e) => [e.name, e]));
  return idx.order.filter((n) => byName.has(n)).map((n) => ({ ...byName.get(n)!, id: idx.ids[n] }));
}

export async function reorderNotes(ws: string, order: string[]): Promise<void> {
  const idx = await loadIndex(ws);
  idx.order = order;
  await saveIndex(ws, idx);
}

export async function resolveNoteId(ws: string, id: number): Promise<string | null> {
  const idx = await loadIndex(ws);
  const name = Object.keys(idx.ids).find((n) => idx.ids[n] === id);
  return name ? `${notesDir(ws)}/${name}` : null;
}

export async function renameNote(ws: string, oldPath: string, newName: string): Promise<string> {
  const safe = newName.trim().replace(/[\/\\:]/g, "-") || "Untitled";
  const dir = notesDir(ws);
  const newPath = `${dir}/${safe}.md`;
  if (newPath === oldPath) return oldPath;

  await invoke("rename_note", { from: oldPath, to: newPath });

  const oldFile = oldPath.split("/").pop() ?? "";
  const newFile = `${safe}.md`;
  const idx = await loadIndex(ws);
  if (idx.ids[oldFile] != null) {
    idx.ids[newFile] = idx.ids[oldFile];
    delete idx.ids[oldFile];
  }
  idx.order = idx.order.map((n) => (n === oldFile ? newFile : n));
  await saveIndex(ws, idx);
  return newPath;
}

export async function appendDailyNote(ws: string, noteName: string, text: string): Promise<void> {
  const path = `${notesDir(ws)}/${noteName}.md`;
  let body = "";
  try {
    body = await readNote(path);
  } catch {
    body = `# ${noteName}\n`;
  }
  await writeNote(path, body + text);
}

export async function addBoardTask(
  ws: string,
  title: string,
  meta?: { due?: string },
): Promise<void> {
  const path = boardPath(ws);
  const board = ensureColumns(parseBoard(await readNote(path)));
  if (!addTask(board, "Todo", title, meta)) throw new Error("Todo column missing");
  await writeNote(path, serializeBoard(board));
}

export async function createTaskFromPr(
  ws: string,
  pr: {
    repo: string;
    number: number;
    title: string;
    url: string;
    review_requested_of_me?: boolean;
  },
): Promise<void> {
  const path = boardPath(ws);
  const board = ensureColumns(parseBoard(await readNote(path)));
  const repoName = pr.repo.split("/").pop() ?? pr.repo;
  const title = pr.review_requested_of_me
    ? `Review: ${pr.title} #${repoName} #review`
    : `${pr.title} #${repoName}`;
  if (!addTask(board, "Todo", title, { pr: pr.url })) throw new Error("Todo column missing");
  await writeNote(path, serializeBoard(board));
}

const AUTO_TODO_KEY = "sapphire.autoTodoSeen";
function loadAutoTodoSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(AUTO_TODO_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

// Add any PR you authored to the Daily board's Todo column, once each. A "seen"
// set records URLs we've added so deleting the task won't make it reappear.
export async function syncCreatedPrsToTodo(ws: string): Promise<number> {
  let prs;
  try {
    prs = await fetchPrs();
  } catch {
    return 0;
  }
  const authored = prs.filter((p) => p.authored);
  if (authored.length === 0) return 0;

  const seen = loadAutoTodoSeen();
  const path = boardPath(ws);
  let board;
  try {
    board = ensureColumns(parseBoard(await readNote(path)));
  } catch {
    return 0;
  }
  const onBoard = new Set<string>();
  for (const col of board.columns) for (const t of tasksIn(col)) if (t.pr) onBoard.add(t.pr);

  let added = 0;
  for (const pr of authored) {
    if (seen.has(pr.url) || onBoard.has(pr.url)) {
      seen.add(pr.url);
      continue;
    }
    const repoName = pr.repo.split("/").pop() ?? pr.repo;
    addTask(board, "Todo", `${pr.title} #${repoName}`, { pr: pr.url });
    seen.add(pr.url);
    added++;
  }
  localStorage.setItem(AUTO_TODO_KEY, JSON.stringify([...seen]));
  if (added > 0) await writeNote(path, serializeBoard(board));
  return added;
}

export async function createNote(ws: string, title: string): Promise<string> {
  return invoke<string>("create_note", { dir: notesDir(ws), title });
}
