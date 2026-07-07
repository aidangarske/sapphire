import { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import { useInputLock } from "../inputLock.ts";
import * as ed from "../editor.ts";

function sanitize(input: string): string {
  return input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}

export function NoteEditor({
  title,
  initial,
  height,
  width,
  onSave,
  onCancel,
}: {
  title: string;
  initial: string;
  height: number;
  width: number;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const c = useTheme();
  useInputLock();
  const [state, setState] = useState<ed.EditorState>(() => ed.fromText(initial));
  const [dirty, setDirty] = useState(false);
  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);

  const viewH = Math.max(1, height - 2);
  const viewW = Math.max(10, width - 6);

  const edit = (fn: (s: ed.EditorState) => ed.EditorState) => {
    setState((s) => fn(s));
    setDirty(true);
  };
  const move = (fn: (s: ed.EditorState) => ed.EditorState) => setState((s) => fn(s));

  useInput((input, key) => {
    if (key.ctrl && input === "s") {
      onSave(ed.toText(state));
      return;
    }
    if (key.escape) {
      if (dirty) onSave(ed.toText(state));
      else onCancel();
      return;
    }
    if (key.ctrl && input === "q") {
      onCancel();
      return;
    }
    if (key.leftArrow) return move(ed.moveLeft);
    if (key.rightArrow) return move(ed.moveRight);
    if (key.upArrow) return move(ed.moveUp);
    if (key.downArrow) return move(ed.moveDown);
    if (key.ctrl && input === "a") return move(ed.moveHome);
    if (key.ctrl && input === "e") return move(ed.moveEnd);
    if (key.return) return edit(ed.newline);
    if ((key.ctrl && input === "w") || (key.backspace && key.meta)) return edit(ed.deleteWord);
    if (key.backspace) return edit(ed.backspace);
    if (key.delete) return edit(ed.del);
    if (key.tab) return edit((s) => ed.insert(s, "  "));
    if (input && !key.ctrl && !key.meta) {
      const clean = sanitize(input);
      if (clean) edit((s) => ed.insert(s, clean));
    }
  });

  // Keep the cursor inside the viewport with minimal scrolling.
  const rowTop = state.row < top ? state.row : state.row >= top + viewH ? state.row - viewH + 1 : top;
  const colLeft = state.col < left ? state.col : state.col >= left + viewW ? state.col - viewW + 1 : left;
  if (rowTop !== top) setTop(rowTop);
  if (colLeft !== left) setLeft(colLeft);

  const rows = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let r = rowTop; r < Math.min(rowTop + viewH, state.lines.length); r++) {
      const raw = state.lines[r] ?? "";
      const slice = raw.slice(colLeft, colLeft + viewW);
      if (r === state.row) {
        const cur = state.col - colLeft;
        const head = slice.slice(0, cur);
        const at = slice.slice(cur, cur + 1) || " ";
        const tail = slice.slice(cur + 1);
        out.push(
          <Text key={r} wrap="truncate">
            <Text color={c.text}>{head}</Text>
            <Text color={c.bg0} backgroundColor={c.accent}>
              {at}
            </Text>
            <Text color={c.text}>{tail}</Text>
          </Text>,
        );
      } else {
        out.push(
          <Text key={r} color={c.text} wrap="truncate">
            {slice.length ? slice : " "}
          </Text>,
        );
      }
    }
    return out;
  }, [state, rowTop, colLeft, viewH, viewW, c]);

  return (
    <Box flexDirection="column" height={height} width={width}>
      <Box justifyContent="space-between">
        <Text color={c.accentHi} bold>
          ✎ {title}
          {dirty ? <Text color={c.warn}> ●</Text> : null}
        </Text>
        <Text color={c.muted}>
          {state.row + 1}:{state.col + 1}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={c.accent} paddingX={1}>
        {rows}
      </Box>
      <Text color={c.muted}>
        Ctrl+S save · Esc save & close · Ctrl+Q discard · ↑↓←→ move · Ctrl+A/E line start/end
      </Text>
    </Box>
  );
}
