import { requireWorkspace } from "../context.ts";
import { ok, fail } from "../output.ts";
import { flagStr } from "../args.ts";
import * as boards from "../../services/boards.ts";
import { runNightlyClear } from "../../services/nightly.ts";
import { logActivity } from "../../services/daily.ts";
import {
  tasksIn,
  addTask,
  moveTask,
  toggleTask,
  ensureColumns,
  type Board,
  type Task,
} from "../../core/board.ts";
import type { ParsedArgs } from "../args.ts";

interface Flat {
  index: number;
  col: string;
  task: Task;
}

function flatten(board: Board): Flat[] {
  const out: Flat[] = [];
  let i = 1;
  for (const col of board.columns) {
    for (const t of tasksIn(col)) out.push({ index: i++, col: col.key, task: t });
  }
  return out;
}

function findTask(flat: Flat[], ref: string): Flat | undefined {
  if (/^\d+$/.test(ref)) return flat.find((f) => f.index === Number(ref));
  const low = ref.toLowerCase();
  return flat.find((f) => f.task.title.toLowerCase().includes(low));
}

function renderBoard(board: Board): string {
  const lines: string[] = [];
  let i = 1;
  for (const col of board.columns) {
    const tasks = tasksIn(col);
    lines.push(`\n## ${col.key} (${tasks.length})`);
    for (const t of tasks) {
      const box = t.checked ? "x" : " ";
      const title = t.title || "(untitled)";
      lines.push(`  ${String(i++).padStart(2)}. [${box}] ${title}`);
    }
  }
  return lines.join("\n").trim();
}

function boardJson(board: Board) {
  return {
    columns: board.columns.map((c) => ({
      name: c.key,
      tasks: tasksIn(c).map((t, k) => ({
        title: t.title,
        checked: t.checked,
        tags: t.tags,
        pr: t.pr,
        due: t.due,
        _col: c.key,
        _k: k,
      })),
    })),
  };
}

export function boardCommand(sub: string, args: ParsedArgs): void {
  const ws = requireWorkspace(args.flags);
  const rest = args.positionals;
  const activeFile = boards.getActiveBoard(ws);

  switch (sub) {
    case "":
    case "show": {
      const file =
        sub === "show" && rest[0] ? (rest[0].endsWith(".md") ? rest[0] : `${rest[0]}.md`) : activeFile;
      const board = boards.readBoard(ws, file);
      ok(boardJson(board), () => renderBoard(board));
      return;
    }
    case "ls":
    case "boards": {
      const list = boards.listBoards(ws);
      ok(list, (r) =>
        r.map((b: any) => `${b.isDefault ? "* " : "  "}${b.name}`).join("\n") || "(no boards)",
      );
      return;
    }
    case "add": {
      const col = rest[0];
      const title = rest.slice(1).join(" ");
      if (!col || !title) fail("bad-args", 'usage: sapphire board add <column> "<title>"');
      const board = ensureColumns(boards.readBoard(ws, activeFile));
      const pr = flagStr(args.flags, "pr");
      const task = addTask(board, col, title, pr ? { pr } : undefined);
      if (!task) fail("not-found", `no column '${col}'`);
      boards.writeBoard(ws, activeFile, board);
      ok({ added: task!.title, column: col }, (r) => `added to ${r.column}: ${r.added}`);
      return;
    }
    case "move": {
      const ref = rest[0];
      const col = rest.slice(1).join(" ");
      if (!ref || !col) fail("bad-args", "usage: sapphire board move <task#|text> <column>");
      const board = boards.readBoard(ws, activeFile);
      const hit = findTask(flatten(board), ref);
      if (!hit) fail("not-found", `no task matching '${ref}'`);
      if (!board.columns.some((c) => c.key === col)) fail("not-found", `no column '${col}'`);
      moveTask(board, hit!.task, col, 9999);
      boards.writeBoard(ws, activeFile, board);
      if (col === "Done") logActivity(ws, "done", hit!.task.title, undefined, hit!.task.pr);
      else if (col === "Blocked") logActivity(ws, "blocked", hit!.task.title, undefined, hit!.task.pr);
      else if (col === "In Progress")
        logActivity(ws, "inprogress", hit!.task.title, undefined, hit!.task.pr);
      ok({ moved: hit!.task.title, to: col }, (r) => `moved to ${r.to}: ${r.moved}`);
      return;
    }
    case "done":
    case "check": {
      const ref = rest[0];
      if (!ref) fail("bad-args", "usage: sapphire board done <task#|text>");
      const board = boards.readBoard(ws, activeFile);
      const hit = findTask(flatten(board), ref);
      if (!hit) fail("not-found", `no task matching '${ref}'`);
      if (!hit!.task.checked) toggleTask(board, hit!.task);
      boards.writeBoard(ws, activeFile, board);
      logActivity(ws, "done", hit!.task.title, undefined, hit!.task.pr);
      ok({ done: hit!.task.title }, (r) => `done: ${r.done}`);
      return;
    }
    case "clear-done": {
      const { removed } = runNightlyClear(ws, true);
      ok({ removed }, (r) => `cleared ${r.removed} done card(s)`);
      return;
    }
    case "new": {
      const name = rest.join(" ").trim();
      if (!name) fail("bad-args", "usage: sapphire board new <name>");
      const path = boards.createBoard(ws, name);
      ok({ path }, (r) => r.path);
      return;
    }
    case "use": {
      const name = rest.join(" ").trim();
      if (!name) fail("bad-args", "usage: sapphire board use <name>");
      const file = name.endsWith(".md") ? name : `${name}.md`;
      boards.setActiveBoard(ws, file);
      ok({ activeBoard: file }, (r) => `active board: ${r.activeBoard}`);
      return;
    }
    default:
      fail("bad-args", `unknown: board ${sub}`);
  }
}
