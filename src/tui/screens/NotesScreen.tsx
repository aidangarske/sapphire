import { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { NoteEditor } from "../components/NoteEditor.tsx";
import { useInputLock } from "../inputLock.ts";
import * as notes from "../../services/notes.ts";
import type { OrderedNote } from "../../core/types.ts";

type Mode = "list" | "new" | "rename" | "search" | "confirm-delete";

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

// First meaningful body line, stripped of markdown markers and the title itself.
function previewLine(text: string, title: string): string {
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "").trim();
    if (!line || line === title) continue;
    return line;
  }
  return "";
}

function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

export function NotesScreen({
  ws,
  active,
  height,
  width,
  suspendAndEdit,
  setHints,
  toast,
}: {
  ws: string;
  active: boolean;
  height: number;
  width: number;
  suspendAndEdit: (path: string) => Promise<void>;
  setHints: (h: string) => void;
  toast: (t: string) => void;
}) {
  const c = useTheme();
  const [list, setList] = useState<OrderedNote[]>(() => notes.listOrderedNotes(ws));
  const [sel, setSel] = useState(0);
  const [mode, setMode] = useState<Mode>("list");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ path: string; name: string; text: string } | null>(null);

  const openEditor = (path: string, name: string) => {
    try {
      setEditing({ path, name: name.replace(/\.md$/, ""), text: notes.readNote(path) });
    } catch {
      setEditing({ path, name: name.replace(/\.md$/, ""), text: "" });
    }
  };
  const saveEditor = (text: string) => {
    if (!editing) return;
    notes.writeNote(editing.path, text);
    setEditing(null);
    reload();
    toast("saved");
  };

  const reload = () => setList(notes.listOrderedNotes(ws));
  useEffect(reload, [ws]);

  // A one-line body preview per note, cached until the list changes.
  const previews = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of list) {
      try {
        m.set(n.path, previewLine(notes.readNote(n.path), n.name.replace(/\.md$/, "")));
      } catch {
        m.set(n.path, "");
      }
    }
    return m;
  }, [list]);

  // Search matches note names AND contents (full text), showing the matching
  // line as a snippet for body/reference hits.
  const filtered = useMemo<Array<OrderedNote & { snippet?: string }>>(() => {
    const q = query.trim();
    if (!q) return list;
    const hits = new Map(notes.searchNotes(ws, q).map((h) => [h.name, h]));
    return list
      .filter((n) => hits.has(n.name))
      .map((n) => {
        const h = hits.get(n.name)!;
        return { ...n, snippet: h.title_match ? undefined : h.snippet };
      });
  }, [list, query, ws]);

  const selIdx = Math.min(sel, Math.max(0, filtered.length - 1));
  const current = filtered[selIdx];

  useEffect(() => {
    if (active && mode === "list") {
      setHints("↑↓ switch note · e/⏎ edit · E $EDITOR · n new · r rename · d delete · / search · ? help");
    }
  }, [active, mode]);

  useInput(
    (input, key) => {
      if (mode !== "list") return;
      const n = filtered.length;
      if (key.upArrow || input === "k") setSel((s) => (n ? (s - 1 + n) % n : 0));
      else if (key.downArrow || input === "j") setSel((s) => (n ? (s + 1) % n : 0));
      else if (input === "g") setSel(0);
      else if (input === "G") setSel(Math.max(0, n - 1));
      else if (key.pageDown) setSel((s) => Math.min(n - 1, s + 6));
      else if (key.pageUp) setSel((s) => Math.max(0, s - 6));
      else if (input === "n") setMode("new");
      else if (input === "r" && current) setMode("rename");
      else if (input === "d" && current) setMode("confirm-delete");
      else if (input === "/") setMode("search");
      else if ((key.return || input === "e") && current) openEditor(current.path, current.name);
      else if (input === "E" && current) {
        void suspendAndEdit(current.path).then(reload);
      }
    },
    { isActive: active && mode === "list" && !editing },
  );

  // Two body rows + a spacer per note; window the list around the selection.
  const per = 3;
  const viewNotes = Math.max(1, Math.floor((height - 1) / per));
  const start = Math.max(0, Math.min(selIdx - Math.floor(viewNotes / 2), Math.max(0, filtered.length - viewNotes)));
  const shown = filtered.slice(start, start + viewNotes);

  if (editing) {
    return (
      <NoteEditor
        title={editing.name}
        initial={editing.text}
        height={height}
        width={width}
        onSave={saveEditor}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <Box flexDirection="column" height={height} width={width}>
      {mode === "search" ? (
        <Prompt
          label="/"
          initial={query}
          onSubmit={(v) => {
            setQuery(v);
            setSel(0);
            setMode("list");
          }}
          onCancel={() => {
            setQuery("");
            setMode("list");
          }}
        />
      ) : mode === "new" ? (
        <Prompt
          label="new note:"
          onSubmit={(v) => {
            setMode("list");
            if (v.trim()) {
              const p = notes.createNote(ws, v.trim());
              reload();
              const idx = notes.listOrderedNotes(ws).findIndex((n) => n.path === p);
              if (idx >= 0) setSel(idx);
              openEditor(p, v.trim());
            }
          }}
          onCancel={() => setMode("list")}
        />
      ) : mode === "rename" && current ? (
        <Prompt
          label="rename:"
          initial={current.name.replace(/\.md$/, "")}
          onSubmit={(v) => {
            setMode("list");
            if (v.trim()) {
              notes.renameNote(ws, current.path, v.trim());
              reload();
              toast("renamed");
            }
          }}
          onCancel={() => setMode("list")}
        />
      ) : mode === "confirm-delete" && current ? (
        <ConfirmDelete
          name={current.name.replace(/\.md$/, "")}
          onYes={() => {
            notes.deleteNote(current.path);
            setMode("list");
            setSel((s) => Math.max(0, s - 1));
            reload();
            toast("deleted");
          }}
          onNo={() => setMode("list")}
        />
      ) : (
        <Text color={c.muted}>
          {filtered.length} notes{query ? ` · "${query}" (Esc clears)` : ""}
        </Text>
      )}

      {filtered.length === 0 ? (
        <Text color={c.muted}>No notes yet. Press n to create one.</Text>
      ) : (
        shown.map((n) => {
          const isSel = n.path === current?.path;
          const title = n.name.replace(/\.md$/, "");
          const snippet = n.snippet ?? previews.get(n.path) ?? "";
          const titleLine = `${isSel ? "▸ " : "  "}${title}`;
          const subLine = `   ${fmtDate(n.modified)}  ${snippet}`;
          return (
            <Box key={n.path} flexDirection="column">
              <Text
                bold
                color={isSel ? c.accentHi : c.text}
                backgroundColor={isSel ? c.bg3 : undefined}
                wrap="truncate"
              >
                {isSel ? pad(titleLine, width) : titleLine}
              </Text>
              <Text color={c.muted} backgroundColor={isSel ? c.bg3 : undefined} wrap="truncate">
                {isSel ? pad(subLine, width) : subLine}
              </Text>
              <Text> </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}

function ConfirmDelete({ name, onYes, onNo }: { name: string; onYes: () => void; onNo: () => void }) {
  const c = useTheme();
  useInputLock();
  useInput((input, key) => {
    if (input === "y" || input === "Y") onYes();
    else if (input === "n" || input === "N" || key.escape) onNo();
  });
  return (
    <Text color={c.bad}>
      delete "{name}"? (y/n)
    </Text>
  );
}
