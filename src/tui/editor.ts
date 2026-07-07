export interface EditorState {
  lines: string[];
  row: number;
  col: number;
}

export function fromText(text: string): EditorState {
  const lines = text.split("\n");
  return { lines: lines.length ? lines : [""], row: 0, col: 0 };
}

export function toText(s: EditorState): string {
  return s.lines.join("\n");
}

function clampCol(s: EditorState, row: number, col: number): number {
  return Math.max(0, Math.min(col, s.lines[row]?.length ?? 0));
}

export function moveLeft(s: EditorState): EditorState {
  if (s.col > 0) return { ...s, col: s.col - 1 };
  if (s.row > 0) return { ...s, row: s.row - 1, col: s.lines[s.row - 1].length };
  return s;
}

export function moveRight(s: EditorState): EditorState {
  if (s.col < s.lines[s.row].length) return { ...s, col: s.col + 1 };
  if (s.row < s.lines.length - 1) return { ...s, row: s.row + 1, col: 0 };
  return s;
}

export function moveUp(s: EditorState): EditorState {
  if (s.row === 0) return { ...s, col: 0 };
  return { ...s, row: s.row - 1, col: clampCol(s, s.row - 1, s.col) };
}

export function moveDown(s: EditorState): EditorState {
  if (s.row === s.lines.length - 1) return { ...s, col: s.lines[s.row].length };
  return { ...s, row: s.row + 1, col: clampCol(s, s.row + 1, s.col) };
}

export function moveByRows(s: EditorState, delta: number): EditorState {
  const row = Math.max(0, Math.min(s.lines.length - 1, s.row + delta));
  return { ...s, row, col: clampCol(s, row, s.col) };
}

export function moveHome(s: EditorState): EditorState {
  return { ...s, col: 0 };
}

export function moveEnd(s: EditorState): EditorState {
  return { ...s, col: s.lines[s.row].length };
}

// Insert text at the cursor. Embedded newlines split into multiple lines and
// leave the cursor at the end of the pasted content.
export function insert(s: EditorState, text: string): EditorState {
  if (!text) return s;
  const line = s.lines[s.row];
  const before = line.slice(0, s.col);
  const after = line.slice(s.col);
  const parts = text.split("\n");
  if (parts.length === 1) {
    const lines = s.lines.slice();
    lines[s.row] = before + text + after;
    return { lines, row: s.row, col: s.col + text.length };
  }
  const inserted = [
    before + parts[0],
    ...parts.slice(1, -1),
    parts[parts.length - 1] + after,
  ];
  const lines = [...s.lines.slice(0, s.row), ...inserted, ...s.lines.slice(s.row + 1)];
  return {
    lines,
    row: s.row + parts.length - 1,
    col: parts[parts.length - 1].length,
  };
}

export function newline(s: EditorState): EditorState {
  return insert(s, "\n");
}

export function backspace(s: EditorState): EditorState {
  if (s.col > 0) {
    const line = s.lines[s.row];
    const lines = s.lines.slice();
    lines[s.row] = line.slice(0, s.col - 1) + line.slice(s.col);
    return { lines, row: s.row, col: s.col - 1 };
  }
  if (s.row > 0) {
    const prev = s.lines[s.row - 1];
    const lines = s.lines.slice();
    lines[s.row - 1] = prev + s.lines[s.row];
    lines.splice(s.row, 1);
    return { lines, row: s.row - 1, col: prev.length };
  }
  return s;
}

export function del(s: EditorState): EditorState {
  const line = s.lines[s.row];
  if (s.col < line.length) {
    const lines = s.lines.slice();
    lines[s.row] = line.slice(0, s.col) + line.slice(s.col + 1);
    return { lines, row: s.row, col: s.col };
  }
  if (s.row < s.lines.length - 1) {
    const lines = s.lines.slice();
    lines[s.row] = line + s.lines[s.row + 1];
    lines.splice(s.row + 1, 1);
    return { lines, row: s.row, col: s.col };
  }
  return s;
}

export interface VSeg {
  row: number;
  start: number;
  end: number;
}

// Word-wrap each logical line into visual segments no wider than `width`.
// Breaks at the last space that fits; hard-breaks a word longer than the width.
export function wrapSegments(lines: string[], width: number): VSeg[] {
  const w = Math.max(1, width);
  const out: VSeg[] = [];
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    if (line.length <= w) {
      out.push({ row: r, start: 0, end: line.length });
      continue;
    }
    let start = 0;
    while (start < line.length) {
      if (line.length - start <= w) {
        out.push({ row: r, start, end: line.length });
        break;
      }
      const hardEnd = start + w;
      const brk = line.lastIndexOf(" ", hardEnd);
      if (brk <= start) {
        out.push({ row: r, start, end: hardEnd });
        start = hardEnd;
      } else {
        out.push({ row: r, start, end: brk });
        start = brk + 1;
      }
    }
  }
  return out;
}

// Map a logical cursor (row, col) to the visual segment holding it and the
// column within that segment. Picks the segment with the greatest start ≤ col
// so a cursor sitting on a wrapped space lands at the end of the prior segment.
export function cursorVisual(vis: VSeg[], row: number, col: number): { index: number; vcol: number } {
  let index = 0;
  let best = -1;
  for (let i = 0; i < vis.length; i++) {
    if (vis[i].row === row && vis[i].start <= col && vis[i].start >= best) {
      best = vis[i].start;
      index = i;
    }
  }
  const seg = vis[index] ?? { row: 0, start: 0, end: 0 };
  return { index, vcol: Math.min(col - seg.start, seg.end - seg.start) };
}

// Delete the word before the cursor (trailing whitespace, then non-whitespace).
export function deleteWord(s: EditorState): EditorState {
  if (s.col === 0) return backspace(s);
  const line = s.lines[s.row];
  const head = line.slice(0, s.col).replace(/\s+$/, "").replace(/[^\s]+$/, "");
  const lines = s.lines.slice();
  lines[s.row] = head + line.slice(s.col);
  return { lines, row: s.row, col: head.length };
}
