import { EditorSelection, EditorState, Prec } from "@codemirror/state";
import { Command, EditorView, drawSelection, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const darkHighlight = HighlightStyle.define([
  { tag: t.heading, color: "var(--text)", fontWeight: "700" },
  { tag: t.strong, fontWeight: "700", color: "var(--text)" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--muted)" },
  { tag: t.link, color: "var(--accent-hi)", textDecoration: "underline" },
  { tag: t.url, color: "var(--muted)" },
  { tag: t.monospace, color: "#e7ecf3" },
  { tag: [t.meta, t.processingInstruction, t.punctuation], color: "var(--muted)" },
  { tag: t.list, color: "var(--accent-hi)" },
  { tag: t.quote, color: "var(--muted)" },
  { tag: t.keyword, color: "#79c0ff" },
  { tag: t.string, color: "#a5d6ff" },
  { tag: t.number, color: "#f0883e" },
  { tag: t.comment, color: "var(--muted)", fontStyle: "italic" },
]);

const theme = EditorView.theme(
  {
    "&": { height: "100%", backgroundColor: "transparent", color: "var(--text)" },
    ".cm-scroller": {
      fontFamily: "var(--mono)",
      fontSize: "14px",
      lineHeight: "1.7",
      padding: "22px 26px",
    },
    ".cm-content": { caretColor: "var(--accent-hi)" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "var(--accent-hi)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
    },
  },
  { dark: true },
);

function wrap(before: string, after = before): Command {
  return (view) => {
    view.dispatch(
      view.state.changeByRange((range) => {
        const text = view.state.sliceDoc(range.from, range.to);
        const insert = before + text + after;
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.range(
            range.from + before.length,
            range.from + before.length + text.length,
          ),
        };
      }),
    );
    return true;
  };
}

const formatKeys = Prec.highest(
  keymap.of([
    { key: "Mod-b", run: wrap("**") },
    { key: "Mod-i", run: wrap("*") },
    { key: "Mod-u", run: wrap("<u>", "</u>") },
  ]),
);

export function createEditorView(
  parent: HTMLElement,
  doc: string,
  onChange: (text: string) => void,
): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [
      formatKeys,
      history(),
      drawSelection(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      markdown(),
      syntaxHighlighting(darkHighlight, { fallback: true }),
      theme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChange(u.state.doc.toString());
      }),
    ],
  });
  return new EditorView({ state, parent });
}
