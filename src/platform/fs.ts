import * as fs from "node:fs";
import { join, basename, dirname, sep } from "node:path";
import { homedir } from "node:os";
import type { NoteEntry, SearchHit } from "../core/types.ts";

let root: string | null = null;

export class WorkspaceError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

export function setWorkspaceRoot(canonPath: string) {
  root = fs.realpathSync(canonPath);
}

export function workspaceRoot(): string {
  if (!root) throw new WorkspaceError("no-workspace", "workspace is not initialized");
  return root;
}

// Port of lib.rs::guard. Canonicalize the path (or its parent + basename when it
// does not exist yet) and require it to stay within the workspace root. The
// `+ sep` boundary avoids the /ws vs /ws-other prefix false-positive.
function guard(path: string): string {
  const r = workspaceRoot();
  let resolved: string;
  try {
    resolved = fs.realpathSync(path);
  } catch {
    const parent = fs.realpathSync(dirname(path));
    resolved = join(parent, basename(path));
  }
  if (resolved === r || resolved.startsWith(r + sep)) return resolved;
  throw new WorkspaceError("outside-workspace", "path is outside the workspace");
}

function mdFiles(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map((e) => join(dir, e.name));
}

export function listNotes(dir: string): NoteEntry[] {
  guard(dir);
  const out: NoteEntry[] = [];
  for (const path of mdFiles(dir)) {
    let modified = 0;
    try {
      modified = Math.floor(fs.statSync(path).mtimeMs / 1000);
    } catch {
      /* ignore */
    }
    out.push({ name: basename(path), path, modified });
  }
  out.sort((a, b) => b.modified - a.modified);
  return out;
}

export function readNote(path: string): string {
  guard(path);
  return fs.readFileSync(path, "utf8");
}

// Atomic: write to a temp sibling then rename, so a note is never left torn if
// the process dies mid-write (or an external editor reads concurrently).
export function writeNote(path: string, contents: string): void {
  guard(path);
  const tmp = `${path}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contents, "utf8");
  fs.renameSync(tmp, path);
}

export function deleteNote(path: string): void {
  guard(path);
  fs.rmSync(path);
}

export function renameNote(from: string, to: string): void {
  guard(from);
  guard(to);
  if (fs.existsSync(to)) {
    throw new WorkspaceError("exists", "A note with that name already exists.");
  }
  fs.renameSync(from, to);
}

export function searchNotes(dir: string, query: string): SearchHit[] {
  guard(dir);
  const hits: SearchHit[] = [];
  const q = query.trim().toLowerCase();
  if (!q) return hits;
  for (const path of mdFiles(dir)) {
    const name = basename(path);
    const titleMatch = name.toLowerCase().includes(q);
    let body = "";
    try {
      body = fs.readFileSync(path, "utf8");
    } catch {
      /* ignore */
    }
    let lineHit: { line: number; snippet: string } | null = null;
    const lines = body.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        lineHit = { line: i + 1, snippet: lines[i].trim() };
        break;
      }
    }
    if (titleMatch || lineHit) {
      hits.push({
        name,
        path,
        line: lineHit?.line ?? 0,
        snippet: lineHit?.snippet ?? "",
        title_match: titleMatch,
      });
    }
  }
  return hits;
}

export function createNote(dir: string, title: string): string {
  guard(dir);
  const base =
    title
      .trim()
      .replace(/[/\\:]/g, "-")
      .trim() || "Untitled";
  for (let i = 0; i < 10000; i++) {
    const name = i === 0 ? `${base}.md` : `${base} ${i}.md`;
    const path = join(dir, name);
    guard(path);
    try {
      const titleLine = name.replace(/\.md$/, "");
      fs.writeFileSync(path, `# ${titleLine}\n\n`, { flag: "wx" });
      return path;
    } catch (e: any) {
      if (e?.code === "EEXIST") continue;
      throw e;
    }
  }
  throw new WorkspaceError("too-many", "too many notes with that name");
}

const WELCOME =
  "# Welcome to Sapphire\n\nType Markdown and it renders **inline** as you go.\n\n- [ ] Try a checkbox\n- [x] This one is done\n\n> A quote, and `inline code`.\n";
const SEED_BOARD =
  "## Todo\n\n- [ ] First task #sapphire\n\n## In Progress\n\n## Blocked\n\n## Done\n\n## Want To Do\n";

// Create the workspace scaffold, refusing $HOME or a filesystem root, then set
// it as the active root. Seeds Welcome.md + board.md on first init.
export function ensureWorkspace(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const canon = fs.realpathSync(dir);
  if (dirname(canon) === canon || canon === fs.realpathSync(homedir())) {
    throw new WorkspaceError("bad-workspace", "refusing to use that folder as a workspace");
  }
  for (const sub of ["notes", "tasks", "config"]) {
    fs.mkdirSync(join(canon, sub), { recursive: true });
  }
  root = canon;
  const welcome = join(canon, "notes", "Welcome.md");
  if (!fs.existsSync(welcome)) fs.writeFileSync(welcome, WELCOME);
  const board = join(canon, "tasks", "board.md");
  if (!fs.existsSync(board)) fs.writeFileSync(board, SEED_BOARD);
  return canon;
}

export function readTextIfExists(path: string): string | null {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function writeText(path: string, contents: string): void {
  fs.mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contents, "utf8");
  fs.renameSync(tmp, path);
}

export function isWorkspace(dir: string): boolean {
  try {
    if (fs.existsSync(join(dir, "config", "notes-index.json"))) return true;
    return fs.existsSync(join(dir, "notes")) && fs.existsSync(join(dir, "tasks"));
  } catch {
    return false;
  }
}
