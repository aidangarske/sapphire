import { describe, it, expect, afterEach } from "bun:test";
import { render } from "ink-testing-library";
import { useState } from "react";
import { Text } from "ink";
import { ThemeProvider } from "./useTheme.tsx";
import { Prompt } from "./components/Prompt.tsx";
import { applyDeletion } from "./textedit.ts";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});
const tick = () => new Promise((r) => setTimeout(r, 20));

describe("text deletion helper", () => {
  it("deletes a word back to the previous whitespace", () => {
    expect(applyDeletion("hello world", "word")).toBe("hello ");
    expect(applyDeletion("hello world  ", "word")).toBe("hello ");
    expect(applyDeletion("oneword", "word")).toBe("");
  });
  it("deletes the whole line", () => {
    expect(applyDeletion("anything here", "line")).toBe("");
  });
  it("deletes a single char", () => {
    expect(applyDeletion("abc", "char")).toBe("ab");
  });
});

function Harness() {
  const [done, setDone] = useState<string | null>(null);
  return done === null ? (
    <Prompt label=">" initial="the quick brown fox" onSubmit={setDone} onCancel={() => setDone("CANCEL")} />
  ) : (
    <Text>RESULT:{done}:</Text>
  );
}

describe("Prompt word/line delete via real key bytes", () => {
  it("Option+Backspace (\\x1b\\x7f) deletes a word, Ctrl+U clears, Ctrl+W too", async () => {
    const r = render(
      <ThemeProvider id="sapphire">
        <Harness />
      </ThemeProvider>,
    );
    cleanups.push(r.unmount);
    await tick();

    r.stdin.write("\x1b\x7f"); // Option+Backspace -> remove "fox"
    await tick();
    r.stdin.write("\x17"); // Ctrl+W -> remove "brown "
    await tick();
    r.stdin.write("\r"); // submit
    await tick();
    expect(r.lastFrame()).toContain("RESULT:the quick :");
  });

  it("Ctrl+U clears the whole line", async () => {
    const r = render(
      <ThemeProvider id="sapphire">
        <Harness />
      </ThemeProvider>,
    );
    cleanups.push(r.unmount);
    await tick();
    r.stdin.write("\x15"); // Ctrl+U
    await tick();
    r.stdin.write("hi");
    await tick();
    r.stdin.write("\r");
    await tick();
    expect(r.lastFrame()).toContain("RESULT:hi:");
  });
});
