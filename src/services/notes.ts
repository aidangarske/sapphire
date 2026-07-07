import * as fsx from "../platform/fs.ts";
import { notesDir, indexPath, notePath } from "../core/workspacePaths.ts";
import {
  parseIndex,
  reconcileIndex,
  orderedNotes,
  resolveId,
  emptyIndex,
} from "../core/notesIndex.ts";
import type { OrderedNote, SearchHit, NotesIndex } from "../core/types.ts";

function loadIndex(ws: string): NotesIndex {
  const raw = fsx.readTextIfExists(indexPath(ws));
  return raw ? parseIndex(raw) : emptyIndex();
}

function saveIndex(ws: string, idx: NotesIndex): void {
  fsx.writeText(indexPath(ws), JSON.stringify(idx, null, 2) + "\n");
}

export function listOrderedNotes(ws: string): OrderedNote[] {
  const entries = fsx.listNotes(notesDir(ws));
  const idx = loadIndex(ws);
  const { index, changed } = reconcileIndex(idx, entries);
  if (changed) saveIndex(ws, index);
  return orderedNotes(index, entries);
}

export function reorderNotes(ws: string, order: string[]): void {
  const idx = loadIndex(ws);
  idx.order = order;
  saveIndex(ws, idx);
}

export function resolveNoteId(ws: string, id: number): string | null {
  const name = resolveId(loadIndex(ws), id);
  return name ? `${notesDir(ws)}/${name}` : null;
}

export function createNote(ws: string, title: string): string {
  return fsx.createNote(notesDir(ws), title);
}

export function readNote(path: string): string {
  return fsx.readNote(path);
}

export function writeNote(path: string, contents: string): void {
  fsx.writeNote(path, contents);
}

export function deleteNote(path: string): void {
  fsx.deleteNote(path);
}

export function searchNotes(ws: string, query: string): SearchHit[] {
  return fsx.searchNotes(notesDir(ws), query);
}

export function renameNote(ws: string, oldPath: string, newName: string): string {
  const safe = newName.trim().replace(/[/\\:]/g, "-") || "Untitled";
  const newPath = notePath(ws, safe);
  if (newPath === oldPath) return oldPath;
  fsx.renameNote(oldPath, newPath);

  const oldFile = oldPath.split("/").pop() ?? "";
  const newFile = `${safe}.md`;
  const idx = loadIndex(ws);
  if (idx.ids[oldFile] != null) {
    idx.ids[newFile] = idx.ids[oldFile];
    delete idx.ids[oldFile];
  }
  idx.order = idx.order.map((n) => (n === oldFile ? newFile : n));
  saveIndex(ws, idx);
  return newPath;
}

export function appendDailyNote(ws: string, noteName: string, text: string): void {
  const path = notePath(ws, noteName);
  const existing = fsx.readTextIfExists(path);
  const body = existing ?? `# ${noteName}\n`;
  fsx.writeNote(path, body + text);
}
