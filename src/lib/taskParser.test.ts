import { describe, it, expect } from "vitest";
import { addTask, moveTask, parseBoard, serializeBoard, tasksIn, toggleTask } from "./taskParser";

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

describe("taskParser round-trip", () => {
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

describe("taskParser mutations", () => {
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
    // Todo titles: [Fix CI failure, Write README, C, D] — move the first to index 2
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
