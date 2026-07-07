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
  const [gutter, setGutter] = useState(true);

  const viewH = Math.max(1, height - 2);
  const gutterW = gutter ? Math.max(2, String(state.lines.length).length) : 0;
  const viewW = Math.max(10, width - 4 - gutterW);

  const edit = (fn: (s: ed.EditorState) => ed.EditorState) => {
    setState((s) => fn(s));
    setDirty(true);
  };
  const move = (fn: (s: ed.EditorState) => ed.EditorState) => setState((s) => fn(s));

  useInput((input, key) => {
    // Treat Cmd (super, via the kitty protocol) the same as Ctrl for shortcuts.
    const mod = key.ctrl || key.super;
    if (mod && input === "s") {
      onSave(ed.toText(state));
      return;
    }
    if (key.escape) {
      if (dirty) onSave(ed.toText(state));
      else onCancel();
      return;
    }
    if (mod && input === "q") {
      onCancel();
      return;
    }
    if (mod && input === "g") {
      setGutter((v) => !v);
      return;
    }
    if (key.leftArrow) return move(ed.moveLeft);
    if (key.rightArrow) return move(ed.moveRight);
    if (key.upArrow) return move(ed.moveUp);
    if (key.downArrow) return move(ed.moveDown);
    if (key.home || (mod && input === "a")) return move(ed.moveHome);
    if (key.end || (mod && input === "e")) return move(ed.moveEnd);
    if (key.pageDown) return move((s) => ed.moveByRows(s, viewH - 1));
    if (key.pageUp) return move((s) => ed.moveByRows(s, -(viewH - 1)));
    if (key.return) return edit(ed.newline);
    if (key.backspace && (mod || key.meta)) return edit(mod ? ed.deleteToLineStart : ed.deleteWord);
    if (mod && input === "w") return edit(ed.deleteWord);
    if (key.backspace) return edit(ed.backspace);
    if (key.delete) return edit(ed.del);
    if (key.tab) return edit((s) => ed.insert(s, "  "));
    if (input && !mod && !key.meta) {
      const clean = sanitize(input);
      if (clean) edit((s) => ed.insert(s, clean));
    }
  });

  // Word-wrap into visual rows, then keep the cursor's visual row in view.
  const vis = useMemo(() => ed.wrapSegments(state.lines, viewW), [state.lines, viewW]);
  const { index: curVis, vcol } = ed.cursorVisual(vis, state.row, state.col);
  const rowTop = curVis < top ? curVis : curVis >= top + viewH ? curVis - viewH + 1 : top;
  if (rowTop !== top) setTop(rowTop);

  const rows = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let vi = rowTop; vi < Math.min(rowTop + viewH, vis.length); vi++) {
      const seg = vis[vi];
      const slice = state.lines[seg.row].slice(seg.start, seg.end);
      const onCursorRow = vi === curVis;
      // Line number only on the first visual row of each logical line.
      const num = seg.start === 0 ? String(seg.row + 1).padStart(gutterW) : " ".repeat(gutterW);
      const gutterEl = gutter ? (
        <Text color={onCursorRow ? c.accent : c.border}>{num} </Text>
      ) : null;
      out.push(
        <Box key={vi} flexDirection="row">
          {gutterEl}
          {onCursorRow ? (
            <Text wrap="truncate">
              <Text color={c.text}>{slice.slice(0, vcol)}</Text>
              <Text color={c.bg0} backgroundColor={c.accent}>
                {slice.slice(vcol, vcol + 1) || " "}
              </Text>
              <Text color={c.text}>{slice.slice(vcol + 1)}</Text>
            </Text>
          ) : (
            <Text color={c.text} wrap="truncate">
              {slice.length ? slice : " "}
            </Text>
          )}
        </Box>,
      );
    }
    return out;
  }, [state.lines, vis, rowTop, curVis, vcol, viewH, gutter, gutterW, c]);

  return (
    <Box flexDirection="column" height={height} width={width}>
      <Box justifyContent="space-between">
        <Text color={c.accentHi} bold>
          ✎ {title}
          {dirty ? <Text color={c.warn}> ●</Text> : null}
        </Text>
        <Text color={c.muted}>
          Ln {state.row + 1}, Col {state.col + 1} · {state.lines.length} lines
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={c.accent} paddingX={1}>
        {rows}
      </Box>
      <Text color={c.muted}>
        ⌘/Ctrl+S save · Esc close · ⌘Q discard · ⌘G {gutter ? "hide" : "show"} nums · ⌥-drag selects text only
      </Text>
    </Box>
  );
}
