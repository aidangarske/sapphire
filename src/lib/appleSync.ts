import { invoke } from "@tauri-apps/api/core";
import { listOrderedNotes, readNote } from "./store";
import { renderMarkdown } from "./markdown";

const KEY = "sapphire.appleSync";

export const getAppleSyncEnabled = () => localStorage.getItem(KEY) === "1";
export const setAppleSyncEnabled = (on: boolean) => localStorage.setItem(KEY, on ? "1" : "0");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// One-way sync: push every note into the "Sapphire" folder in Apple Notes,
// titled by filename. Returns how many notes were synced.
export async function syncToAppleNotes(ws: string): Promise<number> {
  const list = await listOrderedNotes(ws);
  const notes: { title: string; html: string }[] = [];
  for (const n of list) {
    const title = n.name.replace(/\.md$/, "");
    const html = `<h1>${esc(title)}</h1>` + renderMarkdown(await readNote(n.path));
    notes.push({ title, html });
  }
  return invoke<number>("apple_notes_sync", { notes });
}
