import { useEffect, useRef, useState } from "preact/hooks";
import { Plus, Search } from "lucide-preact";
import Editor, { EditorMode } from "../Editor";
import { createSaver } from "../../lib/saver";
import {
  OrderedNote,
  SearchHit,
  createNote,
  deleteNote,
  listOrderedNotes,
  readNote,
  renameNote,
  reorderNotes,
  resolveNoteId,
  searchNotes,
  writeNote,
} from "../../lib/store";

const MODES: EditorMode[] = ["raw", "rendered", "split"];

const UNTITLED = /^Untitled \d+$/;

function deriveTitle(text: string): string {
  for (const line of text.split("\n")) {
    const t = line.replace(/^#+\s*/, "").trim();
    if (t) return t.replace(/[\/\\:]/g, "-").slice(0, 60).trim();
  }
  return "";
}

export default function NotesTab({
  ws,
  openId,
  onOpened,
  newNoteFlag,
  onNewNoteHandled,
}: {
  ws: string;
  openId: number | null;
  onOpened: () => void;
  newNoteFlag: boolean;
  onNewNoteHandled: () => void;
}) {
  const [notes, setNotes] = useState<OrderedNote[]>([]);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [query, setQuery] = useState("");
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>("split");
  const [menu, setMenu] = useState<{ x: number; y: number; path: string; name: string } | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const saver = useRef(createSaver(writeNote)).current;
  const searchTimer = useRef<number | undefined>(undefined);
  const titleTimer = useRef<number | undefined>(undefined);
  const autoTitle = useRef<Set<string>>(new Set());
  const drag = useRef<{ index: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const notesRef = useRef<OrderedNote[]>([]);
  notesRef.current = notes;
  const activePathRef = useRef<string | null>(activePath);
  activePathRef.current = activePath;

  async function refresh(selectPath?: string) {
    const list = await listOrderedNotes(ws);
    setNotes(list);
    const target = selectPath ?? activePath ?? list[0]?.path ?? null;
    if (target && target !== activePath) await openNote(target);
    else if (!target) {
      setActivePath(null);
      setContent("");
    }
  }

  async function openNote(path: string) {
    await saver.flush();
    const text = await readNote(path);
    setActivePath(path);
    setContent(text);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws]);

  useEffect(() => {
    if (openId == null) return;
    resolveNoteId(ws, openId).then((path) => {
      if (path) openNote(path);
      onOpened();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setHits(null);
      return;
    }
    searchTimer.current = window.setTimeout(async () => {
      setHits(await searchNotes(ws, query));
    }, 150);
  }, [query, ws]);

  function onEdit(text: string) {
    setContent(text);
    if (!activePath) return;
    saver.schedule(activePath, text);
    const name = (activePath.split("/").pop() ?? "").replace(/\.md$/, "");
    if (autoTitle.current.has(activePath) || UNTITLED.test(name)) {
      const path = activePath;
      clearTimeout(titleTimer.current);
      titleTimer.current = window.setTimeout(() => autoTitleNow(path, text), 600);
    }
  }

  async function autoTitleNow(path: string, text: string) {
    const title = deriveTitle(text);
    if (!title) return;
    const curName = (path.split("/").pop() ?? "").replace(/\.md$/, "");
    if (title === curName) return;
    const taken = new Set(
      notesRef.current.filter((n) => n.path !== path).map((n) => n.name.replace(/\.md$/, "")),
    );
    if (taken.has(title)) return;
    await saver.flush();
    try {
      const newPath = await renameNote(ws, path, title);
      autoTitle.current.delete(path);
      autoTitle.current.add(newPath);
      if (activePathRef.current === path) setActivePath(newPath);
      setNotes(await listOrderedNotes(ws));
    } catch {
      /* name clash or fs error — leave note as-is */
    }
  }

  useEffect(
    () => () => {
      void saver.flush();
    },
    [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  );

  async function addNote() {
    const taken = new Set(notes.map((n) => n.name.replace(/\.md$/, "")));
    let i = 1;
    while (taken.has(`Untitled ${i}`)) i++;
    const path = await createNote(ws, `Untitled ${i}`);
    autoTitle.current.add(path);
    await refresh(path);
  }

  useEffect(() => {
    if (newNoteFlag) {
      addNote();
      onNewNoteHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newNoteFlag]);

  async function commitRename(path: string) {
    const val = renameVal;
    setRenaming(null);
    if (!val.trim()) return;
    await saver.flush();
    autoTitle.current.delete(path);
    try {
      const newPath = await renameNote(ws, path, val);
      await refresh(newPath);
    } catch {
      /* name clash or fs error — leave note as-is */
    }
  }

  async function removeNote(path: string) {
    setMenu(null);
    saver.cancelFor(path);
    await deleteNote(path);
    if (activePathRef.current === path) {
      setActivePath(null);
      setContent("");
    }
    await refresh();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const list = notesRef.current;
        if (list.length === 0) return;
        const digit = e.code.match(/^Digit([1-9])$/);
        if (digit) {
          const i = Number(digit[1]) - 1;
          if (list[i]) {
            e.preventDefault();
            openNote(list[i].path);
          }
          return;
        }
        if (e.code === "BracketRight" || e.code === "BracketLeft") {
          e.preventDefault();
          const cur = list.findIndex((n) => n.path === activePathRef.current);
          const dir = e.code === "BracketRight" ? 1 : -1;
          const next = ((((cur < 0 ? 0 : cur) + dir) % list.length) + list.length) % list.length;
          openNote(list[next].path);
        }
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  function onItemDown(e: PointerEvent, index: number) {
    if (e.button !== 0) return;
    drag.current = { index, moved: false };
    window.addEventListener("pointermove", onItemMove);
    window.addEventListener("pointerup", onItemUp);
  }

  function onItemMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest(
      ".note-item",
    );
    const overIndex = el ? Number(el.getAttribute("data-index")) : -1;
    if (overIndex < 0 || overIndex === d.index) return;
    if (!d.moved) {
      d.moved = true;
      document.body.classList.add("dragging-noselect");
    }
    const next = [...notesRef.current];
    const [moved] = next.splice(d.index, 1);
    next.splice(overIndex, 0, moved);
    d.index = overIndex;
    setNotes(next);
  }

  function onItemUp() {
    window.removeEventListener("pointermove", onItemMove);
    window.removeEventListener("pointerup", onItemUp);
    const d = drag.current;
    drag.current = null;
    document.body.classList.remove("dragging-noselect");
    if (d?.moved) {
      suppressClick.current = true;
      reorderNotes(
        ws,
        notesRef.current.map((n) => n.name),
      );
    }
  }

  const rows = hits ?? notes;
  const activeNote = notes.find((n) => n.path === activePath);

  return (
    <>
      <aside class="list">
        <div class="list-head">
          <div class="search-box">
            <Search size={14} />
            <input
              placeholder="Search notes"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
          </div>
          <button class="icon-btn" title="New note" onClick={addNote}>
            <Plus size={16} />
          </button>
        </div>
        {rows.length === 0 && <div class="placeholder">No notes</div>}
        {rows.map((r, i) => {
          const id = "id" in r ? (r as OrderedNote).id : undefined;
          return (
            <button
              key={r.path}
              data-index={i}
              class={`note-item${activePath === r.path ? " active" : ""}`}
              onPointerDown={(e) => !hits && onItemDown(e, i)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, path: r.path, name: r.name });
              }}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                openNote(r.path);
              }}
            >
              {renaming === r.path ? (
                <input
                  class="note-rename"
                  value={renameVal}
                  ref={(el) => {
                    el?.focus();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onInput={(e) => setRenameVal(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(r.path);
                    } else if (e.key === "Escape") {
                      setRenaming(null);
                    }
                  }}
                  onBlur={() => setRenaming(null)}
                />
              ) : (
                <div class="note-row">
                  {id != null && <span class="note-id">#{id}</span>}
                  <span class="note-name">{r.name.replace(/\.md$/, "")}</span>
                </div>
              )}
              {"snippet" in r && r.snippet && <div class="note-snippet">{r.snippet}</div>}
            </button>
          );
        })}
      </aside>

      <main class="main notes-main">
        {activePath ? (
          <>
            <div class="editor-toolbar">
              <div class="note-heading">
                {activeNote && <span class="note-id">#{activeNote.id}</span>}
                {(activeNote?.name ?? "").replace(/\.md$/, "")}
              </div>
              <div class="seg">
                {MODES.map((m) => (
                  <button key={m} class={mode === m ? "on" : ""} onClick={() => setMode(m)}>
                    {m[0].toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Editor value={content} onChange={onEdit} mode={mode} />
          </>
        ) : (
          <div class="placeholder">Select or create a note</div>
        )}
      </main>

      {menu && (
        <div class="ctx-menu" style={{ left: `${menu.x}px`, top: `${menu.y}px` }}>
          <button
            class="ctx-item"
            onClick={() => {
              setRenameVal(menu.name.replace(/\.md$/, ""));
              setRenaming(menu.path);
              setMenu(null);
            }}
          >
            Rename
          </button>
          <button class="ctx-item danger" onClick={() => removeNote(menu.path)}>
            Delete “{menu.name.replace(/\.md$/, "")}”
          </button>
        </div>
      )}
    </>
  );
}
