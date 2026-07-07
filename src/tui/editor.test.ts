import { describe, it, expect } from "bun:test";
import * as ed from "./editor.ts";

const at = (s: ed.EditorState) => [s.row, s.col];

describe("editor model", () => {
  it("round-trips text through from/to", () => {
    const t = "line one\nline two\n";
    expect(ed.toText(ed.fromText(t))).toBe(t);
    expect(ed.fromText("").lines).toEqual([""]);
  });

  it("inserts characters and advances the cursor", () => {
    let s = ed.fromText("");
    s = ed.insert(s, "h");
    s = ed.insert(s, "i");
    expect(ed.toText(s)).toBe("hi");
    expect(at(s)).toEqual([0, 2]);
  });

  it("splits a line on newline", () => {
    let s = ed.fromText("abcd");
    s = { ...s, col: 2 };
    s = ed.newline(s);
    expect(ed.toText(s)).toBe("ab\ncd");
    expect(at(s)).toEqual([1, 0]);
  });

  it("inserts multi-line pasted text", () => {
    let s = ed.fromText("XY");
    s = { ...s, col: 1 };
    s = ed.insert(s, "1\n2\n3");
    expect(ed.toText(s)).toBe("X1\n2\n3Y");
    expect(at(s)).toEqual([2, 1]);
  });

  it("backspace merges into the previous line at the boundary", () => {
    let s = ed.fromText("ab\ncd");
    s = { ...s, row: 1, col: 0 };
    s = ed.backspace(s);
    expect(ed.toText(s)).toBe("abcd");
    expect(at(s)).toEqual([0, 2]);
  });

  it("forward delete merges the next line at end of line", () => {
    let s = ed.fromText("ab\ncd");
    s = { ...s, row: 0, col: 2 };
    s = ed.del(s);
    expect(ed.toText(s)).toBe("abcd");
    expect(at(s)).toEqual([0, 2]);
  });

  it("deleteWord removes the trailing word", () => {
    let s = ed.fromText("hello world");
    s = { ...s, col: 11 };
    s = ed.deleteWord(s);
    expect(ed.toText(s)).toBe("hello ");
    expect(at(s)).toEqual([0, 6]);
  });

  it("moves across line boundaries and clamps column", () => {
    let s = ed.fromText("abc\nx");
    s = ed.moveEnd(s); // row0 col3
    s = ed.moveDown(s); // clamp to row1 col1
    expect(at(s)).toEqual([1, 1]);
    s = ed.moveLeft(s); // row1 col0
    s = ed.moveLeft(s); // wrap to end of row0
    expect(at(s)).toEqual([0, 3]);
    s = ed.moveRight(s); // wrap to start of row1
    expect(at(s)).toEqual([1, 0]);
  });
});
