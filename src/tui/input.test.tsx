import { describe, it, expect, afterEach } from "bun:test";
import { render } from "ink-testing-library";
import { resolve } from "node:path";
import { setWorkspaceRoot } from "../platform/fs.ts";
import { App } from "./App.tsx";

setWorkspaceRoot(resolve("fixtures/demo"));
const WS = resolve("fixtures/demo");

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

const tick = () => new Promise((r) => setTimeout(r, 30));

describe("TUI input routing", () => {
  it("switches views with 1/2/3 and opens help with ?", async () => {
    const r = render(<App ws={WS} suspendAndEdit={async () => {}} />);
    cleanups.push(r.unmount);
    await tick();
    expect(r.lastFrame()).toMatch(/notes|Welcome/);

    r.stdin.write("2"); // board
    await tick();
    expect(r.lastFrame()).toContain("Todo");
    expect(r.lastFrame()).toContain("In Progress");

    r.stdin.write("3"); // prs
    await tick();
    expect(r.lastFrame()).toContain("Created");

    r.stdin.write("?"); // help overlay
    await tick();
    expect(r.lastFrame()).toContain("keybindings");

    r.stdin.write("\x1b"); // esc closes help
    await tick();
    expect(r.lastFrame()).not.toContain("keybindings");

    r.stdin.write("1"); // back to notes
    await tick();
    expect(r.lastFrame()).toMatch(/Welcome|Daily Notes/);

    r.stdin.write(":"); // command palette
    await tick();
    expect(r.lastFrame()).toContain("Go to Board");
    r.stdin.write("Pull"); // filter
    await tick();
    expect(r.lastFrame()).toContain("Go to Pull Requests");
    expect(r.lastFrame()).not.toContain("Go to Board");
    r.stdin.write("\r"); // run -> switches to PRs
    await tick();
    expect(r.lastFrame()).toContain("Created");
  });

  it("navigates the board and moves a card between columns", async () => {
    // work on a throwaway copy so the fixture stays clean
    const tmp = resolve(
      "/private/tmp/claude-502/-Users-aidangarske-sapphire/9191eb87-e038-4d40-bcbe-ae3898b6ef12/scratchpad/input-ws",
    );
    const fs = await import("node:fs");
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.cpSync(resolve("fixtures/demo"), tmp, { recursive: true });
    setWorkspaceRoot(tmp);

    const r = render(<App ws={tmp} suspendAndEdit={async () => {}} />);
    cleanups.push(r.unmount);
    r.stdin.write("2"); // board view
    await tick();
    r.stdin.write("j"); // move card selection down
    await tick();
    r.stdin.write(">"); // move card to next column
    await tick();
    // board.md on disk should still be valid markdown with the same columns
    const board = fs.readFileSync(`${tmp}/tasks/board.md`, "utf8");
    expect(board).toContain("## Todo");
    expect(board).toContain("## In Progress");
    setWorkspaceRoot(WS);
  });

  it("wraps selection: up at the top jumps to the bottom card", async () => {
    const r = render(<App ws={WS} suspendAndEdit={async () => {}} />);
    cleanups.push(r.unmount);
    r.stdin.write("2"); // board, Todo focused, first card selected
    await tick();
    r.stdin.write("\x1b[A"); // up arrow at the top -> should wrap to the last card
    await tick();
    r.stdin.write("\r"); // open detail on whatever is now selected
    await tick();
    const f = r.lastFrame() ?? "";
    // demo Todo column's last card is "Sketch the board layout"
    expect(f).toContain("Sketch the board layout");
    r.stdin.write("\x1b");
    await tick();
    setWorkspaceRoot(WS);
  });

  it("Enter opens the task detail panel with full title and notes", async () => {
    const r = render(<App ws={WS} suspendAndEdit={async () => {}} />);
    cleanups.push(r.unmount);
    r.stdin.write("2"); // board
    await tick();
    r.stdin.write("\r"); // open detail on the selected card
    await tick();
    const f = r.lastFrame() ?? "";
    expect(f).toContain("column:"); // detail panel chrome
    expect(f).toContain("Write the README"); // full (untruncated) title
    expect(f).toContain("Esc close");
    r.stdin.write("\x1b"); // esc closes detail
    await tick();
    expect(r.lastFrame()).not.toContain("Esc close");
    setWorkspaceRoot(WS);
  });

  it("d marks a card done, dd (d twice) deletes it", async () => {
    const tmp = resolve(
      "/private/tmp/claude-502/-Users-aidangarske-sapphire/9191eb87-e038-4d40-bcbe-ae3898b6ef12/scratchpad/dd-ws",
    );
    const fs = await import("node:fs");
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.cpSync(resolve("fixtures/demo"), tmp, { recursive: true });
    setWorkspaceRoot(tmp);
    const board = () => fs.readFileSync(`${tmp}/tasks/board.md`, "utf8");

    const r = render(<App ws={tmp} suspendAndEdit={async () => {}} />);
    cleanups.push(r.unmount);
    r.stdin.write("2"); // board, first Todo card selected
    await tick();
    r.stdin.write("d"); // mark done
    await tick();
    expect(board()).toContain("- [x] Write the README");
    r.stdin.write("d"); // second d within window -> delete
    await tick();
    expect(board()).not.toContain("Write the README");
    setWorkspaceRoot(WS);
  });

  it("typing in a task box does not fire global shortcuts (t/theme, etc.)", async () => {
    const r = render(<App ws={WS} suspendAndEdit={async () => {}} />);
    cleanups.push(r.unmount);
    r.stdin.write("2"); // board
    await tick();
    r.stdin.write("n"); // open the add-task input
    await tick();
    expect(r.lastFrame()).toContain("add to Todo");
    r.stdin.write("test task"); // contains 't' which used to cycle the theme
    await tick();
    const f = r.lastFrame() ?? "";
    expect(f).toContain("test task"); // typed literally into the box
    expect(f).not.toContain("theme:"); // 't' did NOT trigger the theme toast
    setWorkspaceRoot(WS);
  });
});
