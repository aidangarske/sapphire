import { useEffect, useState } from "preact/hooks";
import {
  NotebookPen,
  SquareKanban,
  GitPullRequest,
  Settings as SettingsIcon,
  FolderOpen,
} from "lucide-preact";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import NotesTab from "./components/notes/NotesTab";
import TasksTab from "./components/tasks/TasksTab";
import PRList from "./components/prs/PRList";
import Settings from "./components/Settings";
import {
  appendDailyNote,
  clearDoneColumn,
  createTaskFromPr,
  getWorkspace,
  initWorkspace,
  pickWorkspace,
  syncCreatedPrsToTodo,
} from "./lib/store";
import { buildDaily, clearDate, dateStr, datesWithActivity, getDailyNoteName } from "./lib/journal";
import { Pr, githubStatus } from "./lib/github";
import { runWatcherTick } from "./lib/watcher";
import { wireNotificationClicks, ensurePermission } from "./lib/notify";
import { Layout, getMainLayout, getListLayout } from "./lib/theme";
import { getAppleSyncEnabled, syncToAppleNotes } from "./lib/appleSync";

const POLL_MS = 60 * 1000;

type Tab = "notes" | "tasks" | "prs" | "settings";

const TABS: { id: Tab; label: string; icon: typeof NotebookPen }[] = [
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "tasks", label: "Tasks", icon: SquareKanban },
  { id: "prs", label: "Pull Requests", icon: GitPullRequest },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("notes");
  const [ws, setWs] = useState<string | null>(getWorkspace());
  const [wsReady, setWsReady] = useState(false);
  const [noteToOpen, setNoteToOpen] = useState<number | null>(null);
  const [pendingNew, setPendingNew] = useState(false);
  const [listW, setListW] = useState<number>(() => {
    const v = Number(localStorage.getItem("sapphire.listW"));
    return v >= 160 && v <= 560 ? v : 260;
  });
  const [mainLayout, setMainLayout] = useState<Layout>(getMainLayout());
  const [listLayout, setListLayout] = useState<Layout>(getListLayout());

  useEffect(() => {
    localStorage.setItem("sapphire.listW", String(listW));
  }, [listW]);

  useEffect(() => {
    const onLayout = () => {
      setMainLayout(getMainLayout());
      setListLayout(getListLayout());
    };
    window.addEventListener("sapphire:layout", onLayout);
    return () => window.removeEventListener("sapphire:layout", onLayout);
  }, []);

  function startResize(e: PointerEvent) {
    e.preventDefault();
    const base = mainLayout === "horizontal" ? 0 : 56;
    const move = (ev: PointerEvent) =>
      setListW(Math.min(560, Math.max(160, ev.clientX - base)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("col-resizing");
    };
    document.body.classList.add("col-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function openNote(id: number) {
    setNoteToOpen(id);
    setTab("notes");
  }

  function createTask(p: Pr) {
    if (ws) createTaskFromPr(ws, p);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.metaKey || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setTab("notes");
        setPendingNew(true);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= TABS.length) {
        e.preventDefault();
        setTab(TABS[n - 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const w = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    w.onCloseRequested(async (event) => {
      event.preventDefault();
      const ok = await ask("Are you sure you want to quit Sapphire?", {
        title: "Quit Sapphire",
        kind: "warning",
      });
      if (ok) await w.destroy();
    }).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    wireNotificationClicks();
    ensurePermission();
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const tick = () => {
      runWatcherTick();
      const w = getWorkspace();
      if (w) syncCreatedPrsToTodo(w);
    };
    githubStatus().then((s) => {
      if (s !== "ok") return;
      tick();
      timer = window.setInterval(tick, POLL_MS);
      window.addEventListener("focus", tick);
    });
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);

  useEffect(() => {
    if (!ws) return;
    setWsReady(false);
    initWorkspace(ws)
      .then(() => setWsReady(true))
      .catch(() => {});
  }, [ws]);

  useEffect(() => {
    if (!ws || !wsReady) return;
    let stop = false;
    const run = () => {
      if (!stop && getAppleSyncEnabled()) syncToAppleNotes(ws).catch(() => {});
    };
    run();
    const id = window.setInterval(run, 60 * 60 * 1000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [ws, wsReady]);

  useEffect(() => {
    if (!ws || !wsReady) return;
    let stop = false;
    // Flush any day's activity older than "today" to the daily note. Runs on
    // launch, on window focus, and every few minutes so it also fires when the
    // app stays open across midnight (overnight) — not only on relaunch.
    const flushPast = async () => {
      const today = dateStr(Date.now());
      for (const d of datesWithActivity()) {
        if (stop || d >= today) continue;
        const md = buildDaily(d);
        if (md) await appendDailyNote(ws, getDailyNoteName(), md);
        clearDate(d);
      }
    };
    // Empty the Daily board's Done column once per day so each morning starts
    // fresh. Skips the very first run so existing dones aren't wiped on launch.
    const clearDoneIfNewDay = async () => {
      const today = dateStr(Date.now());
      const last = localStorage.getItem("sapphire.lastDoneClear");
      if (last === today) return;
      if (last && !stop) await clearDoneColumn(ws);
      localStorage.setItem("sapphire.lastDoneClear", today);
    };
    const tick = async () => {
      await flushPast();
      await clearDoneIfNewDay();
    };
    tick();
    const id = window.setInterval(tick, 5 * 60 * 1000);
    window.addEventListener("focus", tick);
    return () => {
      stop = true;
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, wsReady]);

  async function choose() {
    const picked = await pickWorkspace();
    if (picked) setWs(picked);
  }

  return (
    <div
      class={`app main-${mainLayout} list-${listLayout}`}
      style={{ "--list-w": `${listW}px` } as any}
    >
      <div
        class="list-resizer"
        style={{
          left: mainLayout === "horizontal" ? `${listW}px` : `calc(var(--rail-w) + ${listW}px)`,
        }}
        onPointerDown={startResize}
      />
      <nav class={`rail rail-${mainLayout}`}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            class={`rail-btn${tab === id ? " active" : ""}`}
            title={label}
            onClick={() => setTab(id)}
          >
            <Icon size={20} />
            <span class="rail-label">{label}</span>
          </button>
        ))}
      </nav>

      {!ws ? (
        <>
          <aside class="list">
            <div class="list-title">Notes</div>
          </aside>
          <main class="main">
            <div class="placeholder">
              <div>
                <p>Choose a folder to store your Markdown workspace.</p>
                <button class="btn" onClick={choose}>
                  <FolderOpen size={16} /> Choose workspace folder
                </button>
              </div>
            </div>
          </main>
        </>
      ) : !wsReady ? (
        <>
          <aside class="list">
            <div class="list-title">Notes</div>
          </aside>
          <main class="main">
            <div class="placeholder">Preparing workspace…</div>
          </main>
        </>
      ) : tab === "notes" ? (
        <NotesTab
          ws={ws}
          openId={noteToOpen}
          onOpened={() => setNoteToOpen(null)}
          newNoteFlag={pendingNew}
          onNewNoteHandled={() => setPendingNew(false)}
        />
      ) : tab === "tasks" ? (
        <TasksTab ws={ws} onOpenNote={openNote} />
      ) : tab === "prs" ? (
        <PRList onCreateTask={createTask} />
      ) : (
        <Settings />
      )}
    </div>
  );
}
