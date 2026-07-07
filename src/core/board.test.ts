import { describe, it, expect } from "bun:test";
import {
  addColumn,
  addTask,
  moveTask,
  parseBoard,
  removeColumn,
  renameColumn,
  serializeBoard,
  tasksIn,
  toggleTask,
} from "./board.ts";

const SAMPLE = `Some preamble note.

## Todo

- [ ] Fix CI failure #wolfProvider #bug
  - pr: https://github.com/wolfSSL/wolfProvider/pull/389
  - due: 2026-06-20
- [ ] Write README #docs

## In Progress

- [ ] Debug build

## Blocked

random note kept verbatim

## Done

- [x] Add ES256 test #done
`;

describe("board round-trip", () => {
  it("is byte-identical when unmodified", () => {
    expect(serializeBoard(parseBoard(SAMPLE))).toBe(SAMPLE);
  });

  it("parses columns, tasks, tags and metadata", () => {
    const b = parseBoard(SAMPLE);
    expect(b.columns.map((c) => c.key)).toEqual(["Todo", "In Progress", "Blocked", "Done"]);
    const todo = tasksIn(b.columns[0]);
    expect(todo).toHaveLength(2);
    expect(todo[0].title).toContain("Fix CI failure");
    expect(todo[0].tags).toEqual(["wolfProvider", "bug"]);
    expect(todo[0].pr).toBe("https://github.com/wolfSSL/wolfProvider/pull/389");
    expect(todo[0].due).toBe("2026-06-20");
  });

  it("keeps non-task lines verbatim", () => {
    const b = parseBoard(SAMPLE);
    expect(serializeBoard(b)).toContain("random note kept verbatim");
  });
});

describe("board mutations", () => {
  it("toggles checkbox in place", () => {
    const b = parseBoard(SAMPLE);
    const t = tasksIn(b.columns[0])[0];
    toggleTask(b, t);
    expect(t.checked).toBe(true);
    expect(serializeBoard(b)).toContain("- [x] Fix CI failure #wolfProvider #bug");
    expect(serializeBoard(b)).toContain("  - pr: https://github.com/wolfSSL/wolfProvider/pull/389");
  });

  it("moving to Done checks the box; preserves task body", () => {
    const b = parseBoard(SAMPLE);
    const t = tasksIn(b.columns[0])[0];
    moveTask(b, t, "Done", 0);
    expect(t.checked).toBe(true);
    expect(tasksIn(b.columns[0])).toHaveLength(1);
    const done = tasksIn(b.columns.find((c) => c.key === "Done")!);
    expect(done[0]).toBe(t);
    expect(serializeBoard(b)).toContain("  - due: 2026-06-20");
  });

  it("reorders within a column downward without an off-by-one", () => {
    const b = parseBoard(SAMPLE);
    addTask(b, "Todo", "C");
    addTask(b, "Todo", "D");
    const first = tasksIn(b.columns[0])[0];
    moveTask(b, first, "Todo", 2);
    const titles = tasksIn(b.columns[0]).map((t) => t.title.split(" #")[0].trim());
    expect(titles).toEqual(["Write README", "Fix CI failure", "C", "D"]);
  });

  it("adds a task to a column", () => {
    const b = parseBoard(SAMPLE);
    addTask(b, "In Progress", "New thing #x");
    const ip = tasksIn(b.columns.find((c) => c.key === "In Progress")!);
    expect(ip.map((t) => t.title)).toContain("New thing #x");
  });
});

describe("custom columns", () => {
  it("parses an arbitrary heading as a column", () => {
    const b = parseBoard(`## Todo\n\n## In Review\n\n- [ ] Ship it\n`);
    expect(b.columns.map((c) => c.key)).toEqual(["Todo", "In Review"]);
    expect(tasksIn(b.columns[1])[0].title).toContain("Ship it");
  });

  it("adds, moves into, and serializes a new column", () => {
    const b = parseBoard(SAMPLE);
    expect(addColumn(b, "In Review")).toBeTruthy();
    const t = tasksIn(b.columns[0])[0];
    moveTask(b, t, "In Review", 0);
    expect(tasksIn(b.columns.find((c) => c.key === "In Review")!)[0]).toBe(t);
    expect(serializeBoard(b)).toContain("## In Review");
  });

  it("rejects duplicate column names (case-insensitive)", () => {
    const b = parseBoard(SAMPLE);
    expect(addColumn(b, "todo")).toBeNull();
  });

  it("renames and removes columns", () => {
    const b = parseBoard(SAMPLE);
    expect(renameColumn(b, "Blocked", "Needs Review")).toBe(true);
    expect(b.columns.map((c) => c.key)).toContain("Needs Review");
    expect(serializeBoard(b)).toContain("## Needs Review");
    removeColumn(b, "Needs Review");
    expect(b.columns.map((c) => c.key)).not.toContain("Needs Review");
  });
});
