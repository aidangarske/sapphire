import { useEffect, useRef, useState } from "preact/hooks";
import type { EditorView } from "@codemirror/view";
import { renderMarkdown } from "../lib/markdown";

export type EditorMode = "raw" | "rendered" | "split";

interface Props {
  value: string;
  onChange: (text: string) => void;
  mode: EditorMode;
}

interface TaskMarker {
  from: number;
  to: number;
  checked: boolean;
}

// Mirror the checkboxes markdown-it-task-lists actually renders: line-anchored
// task items (unordered or ordered), skipping anything inside a fenced code block.
function taskMarkers(doc: string): TaskMarker[] {
  const out: TaskMarker[] = [];
  const lines = doc.split("\n");
  let offset = 0;
  let inFence = false;
  let fence = "";
  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fence = marker;
      } else if (marker === fence) {
        inFence = false;
        fence = "";
      }
    } else if (!inFence) {
      const m = line.match(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/);
      if (m) {
        const boxStart = offset + m[1].length;
        out.push({ from: boxStart, to: boxStart + 1, checked: m[2].toLowerCase() === "x" });
      }
    }
    offset += line.length + 1;
  }
  return out;
}

export default function Editor({ value, onChange, mode }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  const [html, setHtml] = useState(() => renderMarkdown(value));

  useEffect(() => {
    let cancelled = false;
    import("../lib/createEditor").then(({ createEditorView }) => {
      if (cancelled || !host.current) return;
      view.current = createEditorView(host.current, valueRef.current, (t) => {
        onChangeRef.current(t);
        setHtml(renderMarkdown(t));
      });
    });
    return () => {
      cancelled = true;
      view.current?.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
    setHtml(renderMarkdown(value));
  }, [value]);

  function onPreviewClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    const boxes = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll('input[type="checkbox"]'),
    );
    const idx = boxes.indexOf(target as HTMLInputElement);
    if (idx >= 0) toggleNthTask(idx);
  }

  function toggleNthTask(n: number) {
    const v = view.current;
    const doc = v ? v.state.doc.toString() : valueRef.current;
    const mk = taskMarkers(doc)[n];
    if (!mk) return;
    const insert = mk.checked ? " " : "x";
    if (v) v.dispatch({ changes: { from: mk.from, to: mk.to, insert } });
    else {
      const next = doc.slice(0, mk.from) + insert + doc.slice(mk.to);
      onChangeRef.current(next);
      setHtml(renderMarkdown(next));
    }
  }

  return (
    <div class={`split mode-${mode}`}>
      <div class="pane pane-raw" ref={host} />
      <div
        class="pane pane-rendered markdown-body"
        onClick={onPreviewClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
