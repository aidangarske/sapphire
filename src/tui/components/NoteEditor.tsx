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

  const viewH = Math.max(1, height - 2);
  const gutterW = Math.max(2, String(state.lines.length).length);
  const viewW = Math.max(10, width - 4 - gutterW);

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
    if (key.pageDown) return move((s) => ed.moveByRows(s, viewH - 1));
    if (key.pageUp) return move((s) => ed.moveByRows(s, -(viewH - 1)));
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
      const gutter = (
        <Text color={onCursorRow ? c.accent : c.border}>{num} </Text>
      );
      out.push(
        <Box key={vi} flexDirection="row">
          {gutter}
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
  }, [state.lines, vis, rowTop, curVis, vcol, viewH, gutterW, c]);

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
        Ctrl+S save · Esc close · Ctrl+Q discard · PgUp/PgDn · drag-select + Cmd+C/⌘V copy·paste
      </Text>
    </Box>
  );
}
