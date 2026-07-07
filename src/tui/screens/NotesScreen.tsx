import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { NoteEditor } from "../components/NoteEditor.tsx";
import { useInputLock } from "../inputLock.ts";
import { useWheel } from "../useWheel.ts";
import { loadConfig } from "../../platform/config.ts";
import { renderMarkdownLines } from "../markdown.tsx";
import * as notes from "../../services/notes.ts";
import type { OrderedNote } from "../../core/types.ts";

type Mode = "list" | "new" | "rename" | "search" | "confirm-delete";

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
  const [body, setBody] = useState("");
  const [scroll, setScroll] = useState(0);
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
    setBody(text);
    setEditing(null);
    reload();
    toast("saved");
  };

  const reload = () => setList(notes.listOrderedNotes(ws));
  useEffect(reload, [ws]);

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

  const current = filtered[Math.min(sel, filtered.length - 1)];

  // Debounced preview load: scrolling the list stays instant; the note body is
  // read + rendered only once the cursor settles, so large notes never lag.
  const bodyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setScroll(0);
    if (!current) {
      setBody("");
      return;
    }
    const path = current.path;
    clearTimeout(bodyTimer.current);
    bodyTimer.current = setTimeout(() => {
      try {
        setBody(notes.readNote(path));
      } catch {
        setBody("");
      }
    }, 40);
    return () => clearTimeout(bodyTimer.current);
  }, [current?.path]);

  useEffect(() => {
    if (active && mode === "list") {
      setHints("j/k switch note · ↑↓/wheel scroll · e/⏎ edit · E $EDITOR · n new · / search · ? help");
    }
  }, [active, mode]);

  // Preview scroll (bounded to the note length). Space/Ctrl+D page down, b/Ctrl+U up.
  const rawLines = useMemo(() => body.split("\n"), [body]);
  const pageStep = Math.max(1, height - 4);
  const maxScroll = Math.max(0, rawLines.length - (height - 2));
  const scrollBy = (d: number) => setScroll((s) => Math.max(0, Math.min(maxScroll, s + d)));

  // Mouse wheel scrolls the preview when the user has opted into mouse mode.
  useWheel((delta) => scrollBy(delta), active && mode === "list" && loadConfig().mouse);

  useInput(
    (input, key) => {
      if (mode !== "list") return;
      const n = filtered.length;
      // j/k switch notes; arrows + wheel (via alternate-scroll) scroll the preview.
      if (input === "k") setSel((s) => (n ? (s - 1 + n) % n : 0));
      else if (input === "j") setSel((s) => (n ? (s + 1) % n : 0));
      else if (key.upArrow) scrollBy(-1);
      else if (key.downArrow) scrollBy(1);
      else if (input === "g") setScroll(0);
      else if (input === "G") setScroll(maxScroll);
      else if (key.pageDown || (key.ctrl && input === "d") || input === " ") scrollBy(pageStep);
      else if (key.pageUp || (key.ctrl && input === "u") || input === "b") scrollBy(-pageStep);
      else if (input === "n") setMode("new");
      else if (input === "r" && current) setMode("rename");
      else if (input === "d" && current) setMode("confirm-delete");
      else if (input === "/") {
        setMode("search");
      } else if ((key.return || input === "e") && current) {
        openEditor(current.path, current.name);
      } else if (input === "E" && current) {
        void suspendAndEdit(current.path).then(() => {
          try {
            setBody(notes.readNote(current.path));
          } catch {
            /* deleted in editor */
          }
          reload();
        });
      }
    },
    { isActive: active && mode === "list" && !editing },
  );

  // Render only the visible window of lines, not the whole note — bounds preview
  // cost to the viewport regardless of note size.
  const winStart = Math.max(0, Math.min(scroll, Math.max(0, rawLines.length - 1)));
  const windowText = rawLines.slice(winStart, winStart + (height - 2)).join("\n");
  const visible = useMemo(() => renderMarkdownLines(windowText, c), [windowText, c]);
  const hasMore = rawLines.length > winStart + (height - 2);

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
    <Box flexDirection="row" height={height}>
      <Box flexDirection="column" width={30} marginRight={1}>
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
        ) : (
          <Text color={c.muted}>{filtered.length} notes{query ? ` · "${query}"` : ""}</Text>
        )}
        {filtered.slice(0, height - 2).map((n, i) => {
          const isSel = i === Math.min(sel, filtered.length - 1);
          return (
            <Box key={n.path} flexDirection="column">
              <Text color={isSel ? c.bg0 : undefined} backgroundColor={isSel ? c.accent : undefined} wrap="truncate">
                {isSel ? "▸" : " "} #{n.id} {n.name.replace(/\.md$/, "")}
              </Text>
              {n.snippet ? (
                <Text color={c.muted} wrap="truncate">
                  {"   "}
                  {n.snippet}
                </Text>
              ) : null}
            </Box>
          );
        })}
        {mode === "new" && (
          <Prompt
            label="new note:"
            onSubmit={(v) => {
              setMode("list");
              if (v.trim()) {
                const p = notes.createNote(ws, v.trim());
                reload();
                const nl = notes.listOrderedNotes(ws);
                const idx = nl.findIndex((n) => n.path === p);
                if (idx >= 0) setSel(idx);
                openEditor(p, v.trim());
              }
            }}
            onCancel={() => setMode("list")}
          />
        )}
        {mode === "rename" && current && (
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
        )}
        {mode === "confirm-delete" && current && (
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
        )}
      </Box>
      <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={c.border} paddingX={1}>
        {current ? (
          <>
            <Text color={c.accentHi} bold>
              {current.name.replace(/\.md$/, "")}
            </Text>
            {visible}
            {hasMore && <Text color={c.muted}>… more (PgDn)</Text>}
          </>
        ) : (
          <Text color={c.muted}>No notes yet. Press n to create one.</Text>
        )}
      </Box>
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
