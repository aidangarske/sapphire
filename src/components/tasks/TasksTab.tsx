import { useRef, useState } from "preact/hooks";
import { useEffect } from "preact/hooks";
import { Plus } from "lucide-preact";
import {
  Board,
  ColumnKey,
  Task,
  addColumn,
  addTask,
  ensureColumns,
  moveTask,
  parseBoard,
  removeColumn,
  removeTask,
  renameColumn,
  serializeBoard,
  setTaskColor,
  tasksIn,
  toggleTask,
  updateTask,
} from "../../lib/taskParser";
import {
  BoardFile,
  appendDailyNote,
  createBoard,
  deleteBoard,
  getActiveBoardFile,
  listBoards,
  readNote,
  renameBoard,
  setActiveBoardFile,
  tasksDir,
  writeNote,
} from "../../lib/store";
import { buildDaily, clearDate, dateStr, getDailyNoteName, logActivity } from "../../lib/journal";
import { fetchMergedPrs, openExternal } from "../../lib/github";
import TaskDetail from "./TaskDetail";

const COLORS = [
  { name: "red", hex: "#f85149" },
  { name: "orange", hex: "#f0883e" },
  { name: "green", hex: "#3fb950" },
  { name: "blue", hex: "#2f81f7" },
  { name: "purple", hex: "#a371f7" },
  { name: "pink", hex: "#db61a2" },
];
const colorHex = (name?: string) => COLORS.find((c) => c.name === name)?.hex;

const prNumber = (url: string) => url.match(/\/pull\/(\d+)/)?.[1] ?? "";

const URL_RE = /(https?:\/\/[^\s]+)/g;
function renderTitle(text: string) {
  const out: any[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const url = m[1];
    out.push(
      <a
        class="card-link"
        onClick={(e) => {
          e.stopPropagation();
          openExternal(url);
        }}
      >
        {url}
      </a>,
    );
    last = URL_RE.lastIndex;
  }
  out.push(text.slice(last));
  return out;
}

interface DragState {
  task: Task;
  fromKey: ColumnKey;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  started: boolean;
  ghost: HTMLElement | null;
}

export default function TasksTab({
  ws,
  onOpenNote,
}: {
  ws: string;
  onOpenNote: (id: number) => void;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [, setVersion] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [hoverKey, setHoverKey] = useState<ColumnKey | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; task: Task; key: ColumnKey } | null>(
    null,
  );
  const [selected, setSelected] = useState<{ task: Task; key: ColumnKey } | null>(null);
  const [logMsg, setLogMsg] = useState("");
  const [boards, setBoards] = useState<BoardFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>(getActiveBoardFile());
  const [boardMenu, setBoardMenu] = useState<{ x: number; y: number; board: BoardFile } | null>(
    null,
  );
  const [boardRenaming, setBoardRenaming] = useState<string | null>(null);
  const [boardRenameVal, setBoardRenameVal] = useState("");
  const [colMenu, setColMenu] = useState<{ x: number; y: number; key: ColumnKey } | null>(null);
  const [colRenaming, setColRenaming] = useState<ColumnKey | null>(null);
  const [colRenameVal, setColRenameVal] = useState("");
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;
  const drag = useRef<DragState | null>(null);
  const colDrag = useRef<{ key: ColumnKey; moved: boolean } | null>(null);
  const busyRef = useRef(false);
  busyRef.current = !!(
    selected ||
    menu ||
    boardMenu ||
    boardRenaming ||
    colMenu ||
    colRenaming ||
    addingCol ||
    drag.current
  );

  const fileOf = (path: string) => path.split("/").pop() ?? "";
  const activePath = `${tasksDir(ws)}/${activeFile}`;

  useEffect(() => {
    let cancelled = false;
    listBoards(ws).then((list) => {
      if (cancelled) return;
      setBoards(list);
      const af = list.some((b) => fileOf(b.path) === activeFile) ? activeFile : "board.md";
      setActiveFile(af);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws]);

  useEffect(() => {
    if (!activeFile) return;
    setActiveBoardFile(activeFile);
    readNote(`${tasksDir(ws)}/${activeFile}`)
      .then((t) => {
        const b = ensureColumns(parseBoard(t));
        boardRef.current = b;
        setBoard(b);
        syncMerged();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, activeFile]);

  useEffect(() => {
    const id = window.setInterval(() => syncMerged(), 2 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, activeFile]);

  // Pick up board changes made in the background (e.g. created PRs auto-added to
  // Todo) when the window regains focus, unless the user is mid-interaction.
  useEffect(() => {
    const reload = () => {
      if (busyRef.current) return;
      readNote(`${tasksDir(ws)}/${activeFile}`)
        .then((t) => {
          const b = ensureColumns(parseBoard(t));
          boardRef.current = b;
          setBoard(b);
        })
        .catch(() => {});
    };
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, activeFile]);

  function commit() {
    const b = boardRef.current;
    if (b) writeNote(activePath, serializeBoard(b));
    setVersion((v) => v + 1);
  }

  // Auto-complete tasks whose linked PR has merged: move them to Done.
  async function syncMerged() {
    const b = boardRef.current;
    if (!b) return;
    const open: Task[] = [];
    for (const col of b.columns) {
      if (col.key === "Done") continue;
      for (const t of tasksIn(col)) if (t.pr && !t.checked) open.push(t);
    }
    const urls = [...new Set(open.map((t) => t.pr!))];
    if (urls.length === 0) return;
    let merged: string[];
    try {
      merged = await fetchMergedPrs(urls);
    } catch {
      return;
    }
    const mset = new Set(merged);
    let changed = false;
    for (const t of open) {
      if (t.pr && mset.has(t.pr)) {
        moveTask(b, t, "Done", countOf("Done"));
        logActivity("done", t.title, t.body || undefined, t.pr);
        changed = true;
      }
    }
    if (changed) commit();
  }

  async function refreshBoards(selectFile?: string) {
    const list = await listBoards(ws);
    setBoards(list);
    if (selectFile) setActiveFile(selectFile);
  }

  async function addBoard() {
    const path = await createBoard(ws, "New Board");
    await refreshBoards(fileOf(path));
  }

  async function commitBoardRename(b: BoardFile) {
    const val = boardRenameVal.trim();
    setBoardRenaming(null);
    if (!val) return;
    const newPath = await renameBoard(ws, b.path, val);
    await refreshBoards(fileOf(newPath));
  }

  async function removeBoard(b: BoardFile) {
    setBoardMenu(null);
    if (b.isDefault) return;
    await deleteBoard(b.path);
    await refreshBoards(fileOf(b.path) === activeFile ? "board.md" : undefined);
  }

  function countOf(key: ColumnKey): number {
    const b = boardRef.current;
    const col = b?.columns.find((c) => c.key === key);
    return col ? tasksIn(col).length : 0;
  }

  function onToggle(t: Task, key: ColumnKey) {
    const b = boardRef.current;
    if (!b) return;
    if (!t.checked) {
      if (key === "Done") toggleTask(b, t);
      else moveTask(b, t, "Done", countOf("Done"));
      logActivity("done", t.title, t.body || undefined, t.pr);
    } else {
      if (key === "Done") moveTask(b, t, "Todo", 0);
      else toggleTask(b, t);
    }
    commit();
  }

  function onAdd(key: ColumnKey) {
    const b = boardRef.current;
    const title = (draft[key] ?? "").trim();
    if (!b || !title) return;
    addTask(b, key, title);
    setDraft({ ...draft, [key]: "" });
    commit();
  }

  function commitAddColumn() {
    const b = boardRef.current;
    const name = newColName.trim();
    setAddingCol(false);
    setNewColName("");
    if (b && name && addColumn(b, name)) commit();
  }

  function commitColRename(key: ColumnKey) {
    const b = boardRef.current;
    const val = colRenameVal.trim();
    setColRenaming(null);
    if (b && val && renameColumn(b, key, val)) commit();
  }

  function deleteColumn(key: ColumnKey) {
    const b = boardRef.current;
    setColMenu(null);
    if (!b) return;
    removeColumn(b, key);
    commit();
  }

  function logMove(t: Task, key: ColumnKey) {
    if (key === "Done") logActivity("done", t.title, t.body || undefined, t.pr);
    else if (key === "Blocked") logActivity("blocked", t.title, t.body || undefined, t.pr);
    else if (key === "In Progress") logActivity("inprogress", t.title, t.body || undefined, t.pr);
  }

  async function logToday() {
    const md = buildDaily(dateStr(Date.now()));
    if (!md) {
      setLogMsg("Nothing tracked today yet.");
      return;
    }
    await appendDailyNote(ws, getDailyNoteName(), md);
    clearDate(dateStr(Date.now()));
    setLogMsg(`Logged to "${getDailyNoteName()}".`);
  }

  function clearToday() {
    clearDate(dateStr(Date.now()));
    setLogMsg("Cleared today's tracked activity.");
  }

  function deleteTask(t: Task) {
    const b = boardRef.current;
    if (!b) return;
    removeTask(b, t);
    setMenu(null);
    commit();
  }

  function setColor(t: Task, color: string | null) {
    if (!boardRef.current) return;
    setTaskColor(t, color);
    setMenu(null);
    commit();
  }

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

  useEffect(() => {
    if (!boardMenu) return;
    const close = () => setBoardMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [boardMenu]);

  useEffect(() => {
    if (!colMenu) return;
    const close = () => setColMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [colMenu]);

  function colIndexAt(colEl: Element, y: number): number {
    const cards = Array.from(colEl.querySelectorAll(".card"));
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return cards.length;
  }

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
      d.started = true;
      document.body.classList.add("dragging-noselect");
      const g = document.createElement("div");
      g.className = "card drag-ghost";
      g.textContent = d.task.title.replace(/#[\w-]+/g, "").trim() || "task";
      g.style.width = `${d.width}px`;
      document.body.appendChild(g);
      d.ghost = g;
    }
    if (d.ghost) {
      d.ghost.style.left = `${e.clientX - d.offsetX}px`;
      d.ghost.style.top = `${e.clientY - d.offsetY}px`;
    }
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest(".board-col");
    setHoverKey((col?.getAttribute("data-key") as ColumnKey) ?? null);
  }

  function onUp(e: PointerEvent) {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    document.body.classList.remove("dragging-noselect");
    const d = drag.current;
    drag.current = null;
    setHoverKey(null);
    if (!d) return;
    d.ghost?.remove();
    if (!d.started) return;
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest(".board-col");
    const key = col?.getAttribute("data-key") as ColumnKey | undefined;
    const b = boardRef.current;
    if (col && key && b) {
      moveTask(b, d.task, key, colIndexAt(col, e.clientY));
      logMove(d.task, key);
      commit();
    }
  }

  function onColMove(e: PointerEvent) {
    const d = colDrag.current;
    if (!d) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest(".board-col");
    const overKey = el?.getAttribute("data-key") as ColumnKey | undefined;
    if (!overKey || overKey === d.key) return;
    if (!d.moved) {
      d.moved = true;
      document.body.classList.add("dragging-noselect");
    }
    const cols = boardRef.current?.columns;
    if (!cols) return;
    const from = cols.findIndex((c) => c.key === d.key);
    const to = cols.findIndex((c) => c.key === overKey);
    if (from < 0 || to < 0) return;
    const [m] = cols.splice(from, 1);
    cols.splice(to, 0, m);
    setVersion((v) => v + 1);
  }

  function onColUp() {
    window.removeEventListener("pointermove", onColMove);
    window.removeEventListener("pointerup", onColUp);
    document.body.classList.remove("dragging-noselect");
    const d = colDrag.current;
    colDrag.current = null;
    if (d?.moved) commit();
  }

  function onHeadDown(e: PointerEvent, key: ColumnKey) {
    if (e.button !== 0) return;
    e.preventDefault();
    colDrag.current = { key, moved: false };
    window.addEventListener("pointermove", onColMove);
    window.addEventListener("pointerup", onColUp);
  }

  function onCardDown(e: PointerEvent, t: Task, key: ColumnKey) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("input, a, .card-ref")) return;
    e.preventDefault();
    const card = e.currentTarget as HTMLElement;
    const r = card.getBoundingClientRect();
    drag.current = {
      task: t,
      fromKey: key,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
      width: r.width,
      started: false,
      ghost: null,
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const boardListAside = (
    <aside class="list">
      <div class="list-head">
        <div class="list-title" style={{ flex: 1 }}>
          Boards
        </div>
        <button class="icon-btn" title="New board" onClick={addBoard}>
          <Plus size={16} />
        </button>
      </div>
      {boards.map((b) => {
        const file = fileOf(b.path);
        return (
          <button
            key={b.path}
            class={`note-item${file === activeFile ? " active" : ""}`}
            onClick={() => setActiveFile(file)}
            onContextMenu={(e) => {
              if (b.isDefault) return;
              e.preventDefault();
              setBoardMenu({ x: e.clientX, y: e.clientY, board: b });
            }}
          >
            {boardRenaming === b.path ? (
              <input
                class="note-rename"
                value={boardRenameVal}
                ref={(el) => {
                  el?.focus();
                }}
                onClick={(e) => e.stopPropagation()}
                onInput={(e) => setBoardRenameVal(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitBoardRename(b);
                  } else if (e.key === "Escape") {
                    setBoardRenaming(null);
                  }
                }}
                onBlur={() => setBoardRenaming(null)}
              />
            ) : (
              <div class="note-row">
                <span class="note-name">{b.isDefault ? "Daily" : b.name}</span>
              </div>
            )}
          </button>
        );
      })}
    </aside>
  );

  const boardCtxMenu = boardMenu && (
    <div class="ctx-menu" style={{ left: `${boardMenu.x}px`, top: `${boardMenu.y}px` }}>
      <button
        class="ctx-item"
        onClick={() => {
          setBoardRenameVal(boardMenu.board.name);
          setBoardRenaming(boardMenu.board.path);
          setBoardMenu(null);
        }}
      >
        Rename
      </button>
      <button class="ctx-item danger" onClick={() => removeBoard(boardMenu.board)}>
        Delete board
      </button>
    </div>
  );

  if (!board) {
    return (
      <>
        {boardListAside}
        <div class="board-wrap">
          <div class="placeholder">Loading board…</div>
        </div>
        {boardCtxMenu}
      </>
    );
  }

  return (
    <>
      {boardListAside}
      <div class="board-wrap">
        <div class="board-toolbar">
          <button
            class="btn ghost"
            onClick={logToday}
            title="Append today's done/blocked/in-progress to your daily note"
          >
            Log today → Daily Notes
          </button>
          <button
            class="btn ghost"
            onClick={clearToday}
            title="Discard today's tracked activity (does not touch notes already written)"
          >
            Clear
          </button>
          {logMsg && <span class="board-log-msg">{logMsg}</span>}
        </div>
        <div class="board">
          {board.columns.map((col) => {
            const key = col.key;
            const tasks = tasksIn(col);
            return (
              <section
                class={`board-col${hoverKey === key ? " drop-hover" : ""}`}
                key={key}
                data-key={key}
              >
                <header
                  class="board-col-head"
                  onPointerDown={(e) => {
                    if (colRenaming !== key) onHeadDown(e, key);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setColMenu({ x: e.clientX, y: e.clientY, key });
                  }}
                >
                  {colRenaming === key ? (
                    <input
                      class="note-rename"
                      value={colRenameVal}
                      ref={(el) => {
                        el?.focus();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onInput={(e) => setColRenameVal(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitColRename(key);
                        } else if (e.key === "Escape") {
                          setColRenaming(null);
                        }
                      }}
                      onBlur={() => setColRenaming(null)}
                    />
                  ) : (
                    <>
                      {key}
                      <span class="board-count">{tasks.length}</span>
                    </>
                  )}
                </header>

                <div class="board-col-body">
                  {tasks.map((t, i) => (
                    <article
                      class="card"
                      key={i}
                      style={
                        colorHex(t.color)
                          ? {
                              background: `color-mix(in srgb, ${colorHex(t.color)} 14%, var(--bg-2))`,
                              borderColor: `color-mix(in srgb, ${colorHex(t.color)} 50%, var(--border))`,
                            }
                          : undefined
                      }
                      onPointerDown={(e) => onCardDown(e, t, key)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenu({ x: e.clientX, y: e.clientY, task: t, key });
                      }}
                    >
                      <span class="card-prio">{i + 1}</span>
                      <label class="card-top">
                        <input
                          type="checkbox"
                          checked={t.checked}
                          onChange={() => onToggle(t, key)}
                        />
                        <span class={t.checked ? "card-title done" : "card-title"}>
                          {renderTitle(t.title.replace(/#[\w-]+/g, "").trim())}
                        </span>
                      </label>
                      {(t.tags.length > 0 || t.refs.length > 0 || t.pr) && (
                        <div class="card-meta">
                          {t.refs.map((id) => (
                            <button
                              class="card-ref"
                              key={`r${id}`}
                              onClick={() => onOpenNote(id)}
                              title={`Open note #${id}`}
                            >
                              #{id}
                            </button>
                          ))}
                          {t.tags.map((tag) => (
                            <span class={tag === "review" ? "tag review" : "tag"} key={tag}>
                              #{tag}
                            </span>
                          ))}
                          {t.pr && (
                            <a class="card-pr" href={t.pr} target="_blank" rel="noreferrer">
                              PR{prNumber(t.pr) ? ` #${prNumber(t.pr)}` : ""}
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <div class="card-add">
                  <input
                    placeholder="Add task…"
                    value={draft[key] ?? ""}
                    onInput={(e) => setDraft({ ...draft, [key]: e.currentTarget.value })}
                    onKeyDown={(e) => e.key === "Enter" && onAdd(key)}
                  />
                  <button class="icon-btn" onClick={() => onAdd(key)} title="Add">
                    <Plus size={14} />
                  </button>
                </div>
              </section>
            );
          })}

          {addingCol ? (
            <div class="board-add-col">
              <input
                class="board-add-input"
                placeholder="Column name…"
                value={newColName}
                ref={(el) => {
                  el?.focus();
                }}
                onInput={(e) => setNewColName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitAddColumn();
                  } else if (e.key === "Escape") {
                    setAddingCol(false);
                    setNewColName("");
                  }
                }}
                onBlur={commitAddColumn}
              />
            </div>
          ) : (
            <button class="board-add-col" onClick={() => setAddingCol(true)} title="Add column">
              <Plus size={16} /> Add column
            </button>
          )}
        </div>

        {colMenu && (
          <div class="ctx-menu" style={{ left: `${colMenu.x}px`, top: `${colMenu.y}px` }}>
            <button
              class="ctx-item"
              onClick={() => {
                setColRenameVal(colMenu.key);
                setColRenaming(colMenu.key);
                setColMenu(null);
              }}
            >
              Rename column
            </button>
            <button class="ctx-item danger" onClick={() => deleteColumn(colMenu.key)}>
              Delete column
            </button>
          </div>
        )}

        {menu && (
          <div class="ctx-menu" style={{ left: `${menu.x}px`, top: `${menu.y}px` }}>
            <button
              class="ctx-item"
              onClick={() => {
                setSelected({ task: menu.task, key: menu.key });
                setMenu(null);
              }}
            >
              Details
            </button>
            <button class="ctx-item danger" onClick={() => deleteTask(menu.task)}>
              Delete task
            </button>
            <div class="ctx-colors">
              <button class="ctx-clear" title="No color" onClick={() => setColor(menu.task, null)}>
                ⊘
              </button>
              {COLORS.map((c) => (
                <button
                  class="ctx-swatch"
                  key={c.name}
                  title={c.name}
                  style={{ background: c.hex }}
                  onClick={() => setColor(menu.task, c.name)}
                />
              ))}
            </div>
          </div>
        )}

        {selected && (
          <TaskDetail
            task={selected.task}
            currentKey={selected.key}
            columns={board.columns.map((c) => c.key)}
            onSave={(f) => {
              updateTask(selected.task, f);
              commit();
            }}
            onMove={(k) => {
              const b = boardRef.current;
              if (b) {
                moveTask(b, selected.task, k, countOf(k));
                logMove(selected.task, k);
                commit();
              }
            }}
            onDelete={() => {
              const b = boardRef.current;
              if (b) {
                removeTask(b, selected.task);
                commit();
              }
            }}
            onClose={() => setSelected(null)}
          />
        )}
        {boardCtxMenu}
      </div>
    </>
  );
}
