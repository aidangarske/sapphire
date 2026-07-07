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

// Delete the word before the cursor (trailing whitespace, then non-whitespace).
export function deleteWord(s: EditorState): EditorState {
  if (s.col === 0) return backspace(s);
  const line = s.lines[s.row];
  const head = line.slice(0, s.col).replace(/\s+$/, "").replace(/[^\s]+$/, "");
  const lines = s.lines.slice();
  lines[s.row] = head + line.slice(s.col);
  return { lines, row: s.row, col: head.length };
}
