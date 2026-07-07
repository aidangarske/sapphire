// Columns are user-editable, so a key is any heading text. COLUMN_KEYS is only
// the default set seeded into a blank board.
export const COLUMN_KEYS = ["Todo", "In Progress", "Blocked", "Done", "Want To Do"] as const;
export type ColumnKey = string;

export interface Task {
  lines: string[]; // verbatim source lines (each retains its terminator)
  checked: boolean;
  title: string;
  tags: string[];
  refs: number[]; // note references like #5
  body: string; // free-form notes (indented continuation lines)
  pr?: string;
  project?: string;
  due?: string;
  color?: string;
}

type Node = { kind: "raw"; text: string } | { kind: "task"; task: Task };

export interface Column {
  key: ColumnKey;
  heading: string; // verbatim heading line incl. terminator
  nodes: Node[];
}

export interface Board {
  preamble: string;
  columns: Column[];
}

const HEADING = /^##\s+(.+?)\s*$/;
const TASK = /^(\s*)-\s+\[([ xX])\]\s?(.*)$/;
const META = /^\s*-\s*(pr|project|due|color):\s*(.*\S)\s*$/;

function splitLines(s: string): string[] {
  return s.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

const stripNL = (l: string) => l.replace(/\n$/, "");

function parseTask(lines: string[]): Task {
  const first = stripNL(lines[0]);
  const m = first.match(TASK)!;
  const checked = m[2].toLowerCase() === "x";
  const title = m[3].trim();
  const hashes = [...title.matchAll(/#([\w-]+)/g)].map((x) => x[1]);
  const refs = hashes.filter((h) => /^\d+$/.test(h)).map(Number);
  const tags = hashes.filter((h) => !/^\d+$/.test(h));
  const task: Task = { lines, checked, title, tags, refs, body: "" };
  const bodyLines: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const meta = stripNL(lines[i]).match(META);
    if (meta) {
      if (meta[1] === "pr") task.pr = meta[2];
      else if (meta[1] === "project") task.project = meta[2];
      else if (meta[1] === "due") task.due = meta[2];
      else if (meta[1] === "color") task.color = meta[2];
      continue;
    }
    bodyLines.push(stripNL(lines[i]).replace(/^\s+/, ""));
  }
  task.body = bodyLines.join("\n").trim();
  return task;
}

const isContinuation = (line: string) => /^\s+\S/.test(stripNL(line));

export function parseBoard(text: string): Board {
  const lines = splitLines(text);
  let i = 0;

  let preamble = "";
  while (i < lines.length && !HEADING.test(stripNL(lines[i]))) {
    preamble += lines[i++];
  }

  const columns: Column[] = [];
  while (i < lines.length) {
    const key = stripNL(lines[i]).match(HEADING)![1] as ColumnKey;
    const column: Column = { key, heading: lines[i], nodes: [] };
    i++;
    while (i < lines.length && !HEADING.test(stripNL(lines[i]))) {
      if (TASK.test(stripNL(lines[i]))) {
        const block = [lines[i++]];
        while (i < lines.length && isContinuation(lines[i]) && !TASK.test(stripNL(lines[i]))) {
          block.push(lines[i++]);
        }
        column.nodes.push({ kind: "task", task: parseTask(block) });
      } else {
        column.nodes.push({ kind: "raw", text: lines[i++] });
      }
    }
    columns.push(column);
  }

  return { preamble, columns };
}

export function serializeBoard(board: Board): string {
  let out = board.preamble;
  for (const col of board.columns) {
    out += col.heading;
    for (const node of col.nodes) {
      out += node.kind === "raw" ? node.text : node.task.lines.join("");
    }
  }
  return out;
}

export function tasksIn(col: Column): Task[] {
  return col.nodes
    .filter((n): n is { kind: "task"; task: Task } => n.kind === "task")
    .map((n) => n.task);
}

function setCheckbox(task: Task, checked: boolean) {
  task.checked = checked;
  const line = task.lines[0];
  const nl = line.endsWith("\n") ? "\n" : "";
  task.lines[0] =
    stripNL(line).replace(
      TASK,
      (_full, indent, _box, rest) => `${indent}- [${checked ? "x" : " "}] ${rest}`,
    ) + nl;
}

export function toggleTask(board: Board, task: Task): Board {
  setCheckbox(task, !task.checked);
  return board;
}

export function moveTask(board: Board, task: Task, toKey: ColumnKey, index: number): Board {
  let fromKey: ColumnKey | null = null;
  let fromTaskIndex = -1;
  for (const col of board.columns) {
    const ti = col.nodes.filter((n) => n.kind === "task").findIndex((n) => n.task === task);
    if (ti >= 0) {
      fromKey = col.key;
      fromTaskIndex = ti;
    }
    const at = col.nodes.findIndex((n) => n.kind === "task" && n.task === task);
    if (at >= 0) col.nodes.splice(at, 1);
  }
  const target = board.columns.find((c) => c.key === toKey);
  if (!target) return board;
  if (toKey === "Done") setCheckbox(task, true);
  else if (task.checked) setCheckbox(task, false);
  // the caller's index was computed before removal; a same-column downward
  // move shifts every later slot up by one once the task is spliced out.
  const adjusted = fromKey === toKey && index > fromTaskIndex ? index - 1 : index;
  const taskNodes = target.nodes.filter((n) => n.kind === "task");
  const before = taskNodes[adjusted];
  const insertAt = before ? target.nodes.indexOf(before) : target.nodes.length;
  target.nodes.splice(insertAt, 0, { kind: "task", task });
  return board;
}

// Seed the default columns only into a board that has none yet, so user-added or
// deleted columns are respected on every later load.
export function ensureColumns(board: Board): Board {
  if (board.columns.length > 0) return board;
  for (const key of COLUMN_KEYS) {
    board.columns.push({ key, heading: `\n## ${key}\n`, nodes: [] });
  }
  return board;
}

export function addColumn(board: Board, name: string): Column | null {
  const key = name.trim();
  if (!key || board.columns.some((c) => c.key.toLowerCase() === key.toLowerCase())) return null;
  const column: Column = { key, heading: `\n## ${key}\n`, nodes: [] };
  board.columns.push(column);
  return column;
}

export function renameColumn(board: Board, key: ColumnKey, name: string): boolean {
  const next = name.trim();
  const col = board.columns.find((c) => c.key === key);
  if (!col || !next) return false;
  if (board.columns.some((c) => c !== col && c.key.toLowerCase() === next.toLowerCase())) {
    return false;
  }
  const lead = col.heading.match(/^\n*/)?.[0] ?? "";
  col.key = next;
  col.heading = `${lead}## ${next}\n`;
  return true;
}

export function removeColumn(board: Board, key: ColumnKey): void {
  const i = board.columns.findIndex((c) => c.key === key);
  if (i >= 0) board.columns.splice(i, 1);
}

export function updateTask(
  task: Task,
  fields: { text: string; tags: string[]; body: string },
): void {
  const indent = task.lines[0].match(/^(\s*)/)?.[1] ?? "";
  const box = task.checked ? "x" : " ";
  const tagStr = fields.tags.map((t) => `#${t}`).join(" ");
  const refStr = task.refs.map((r) => `#${r}`).join(" ");
  const titleParts = [fields.text.trim(), tagStr, refStr].filter(Boolean).join(" ");

  const lines: string[] = [`${indent}- [${box}] ${titleParts}\n`];
  if (task.pr) lines.push(`${indent}  - pr: ${task.pr}\n`);
  if (task.project) lines.push(`${indent}  - project: ${task.project}\n`);
  if (task.due) lines.push(`${indent}  - due: ${task.due}\n`);
  if (task.color) lines.push(`${indent}  - color: ${task.color}\n`);
  for (const bl of fields.body.split("\n")) {
    if (bl.trim()) lines.push(`${indent}  ${bl.trim()}\n`);
  }

  task.lines = lines;
  task.title = titleParts;
  task.tags = [...fields.tags];
  task.body = fields.body.trim();
}

export function setTaskColor(task: Task, color: string | null): void {
  const indent = task.lines[0].match(/^(\s*)/)?.[1] ?? "";
  task.lines = task.lines.filter((l, i) => i === 0 || !/^\s*-\s*color:/.test(l));
  task.color = color || undefined;
  if (color) task.lines.splice(1, 0, `${indent}  - color: ${color}\n`);
}

export function removeTask(board: Board, task: Task): Board {
  for (const col of board.columns) {
    const at = col.nodes.findIndex((n) => n.kind === "task" && n.task === task);
    if (at >= 0) {
      col.nodes.splice(at, 1);
      break;
    }
  }
  return board;
}

export function addTask(
  board: Board,
  toKey: ColumnKey,
  title: string,
  meta?: { pr?: string; due?: string },
): Task | null {
  const target = board.columns.find((c) => c.key === toKey);
  if (!target) return null;
  const lines = [`- [${toKey === "Done" ? "x" : " "}] ${title.trim()}\n`];
  if (meta?.pr) lines.push(`  - pr: ${meta.pr}\n`);
  if (meta?.due) lines.push(`  - due: ${meta.due}\n`);
  const task = parseTask(lines);
  target.nodes.push({ kind: "task", task });
  return task;
}
