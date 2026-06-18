import { useEffect, useState } from "preact/hooks";
import {
  NotebookPen,
  SquareKanban,
  GitPullRequest,
  CalendarDays,
  Settings as SettingsIcon,
  FolderOpen,
} from "lucide-preact";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import NotesTab from "./components/notes/NotesTab";
import TasksTab from "./components/tasks/TasksTab";
import PRList from "./components/prs/PRList";
import CalendarTab from "./components/calendar/CalendarTab";
import Settings from "./components/Settings";
import {
  appendDailyNote,
  createTaskFromPr,
  getWorkspace,
  initWorkspace,
  pickWorkspace,
} from "./lib/store";
import { buildDaily, clearDate, dateStr, datesWithActivity, getDailyNoteName } from "./lib/journal";
import { Pr, githubStatus } from "./lib/github";
import { runWatcherTick } from "./lib/watcher";
import { wireNotificationClicks, ensurePermission, getNotifySettings, notify } from "./lib/notify";
import { CalEvent, calendarReady, fetchEvents } from "./lib/calendar";

const POLL_MS = 60 * 1000;

type Tab = "notes" | "tasks" | "prs" | "calendar" | "settings";

const TABS: { id: Tab; label: string; icon: typeof NotebookPen }[] = [
  { id: "notes", label: "Notes", icon: NotebookPen },
  { id: "tasks", label: "Tasks", icon: SquareKanban },
  { id: "prs", label: "Pull Requests", icon: GitPullRequest },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
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

  useEffect(() => {
    localStorage.setItem("sapphire.listW", String(listW));
  }, [listW]);

  function startResize(e: PointerEvent) {
    e.preventDefault();
    const move = (ev: PointerEvent) => setListW(Math.min(560, Math.max(160, ev.clientX - 56)));
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
    let cancelled = false;
    let fetchId: number | undefined;
    let checkId: number | undefined;
    let events: CalEvent[] = [];
    const notified = new Set<string>();
    const refetch = async () => {
      try {
        events = await fetchEvents(2);
      } catch {
        /* offline / not signed in — try next cycle */
      }
    };
    const check = () => {
      const s = getNotifySettings();
      if (!s.calendar) return;
      const now = Date.now();
      const lead = s.leadMin * 60000;
      for (const e of events) {
        if (e.allDay) continue;
        const dt = e.start - now;
        if (dt > 0 && dt <= lead && !notified.has(e.uid)) {
          notified.add(e.uid);
          notify({
            title: `⏰ ${e.summary}`,
            body: `Starts in ${Math.max(1, Math.round(dt / 60000))} min`,
            url: e.url,
          });
        }
      }
    };
    calendarReady().then((ready) => {
      if (!ready || cancelled) return;
      refetch();
      fetchId = window.setInterval(refetch, 5 * 60000);
      checkId = window.setInterval(check, 60000);
    });
    return () => {
      cancelled = true;
      clearInterval(fetchId);
      clearInterval(checkId);
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
    const today = dateStr(Date.now());
    (async () => {
      for (const d of datesWithActivity()) {
        if (d < today) {
          const md = buildDaily(d);
          if (md) await appendDailyNote(ws, getDailyNoteName(), md);
          clearDate(d);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, wsReady]);

  async function choose() {
    const picked = await pickWorkspace();
    if (picked) setWs(picked);
  }

  return (
    <div class="app" style={{ "--list-w": `${listW}px` } as any}>
      <div
        class="list-resizer"
        style={{ left: `calc(var(--rail-w) + ${listW}px)` }}
        onPointerDown={startResize}
      />
      <nav class="rail">
        <div class="rail-brand" title="Sapphire">
          <svg viewBox="104 104 816 816" width="30" height="30" aria-hidden="true">
            <polygon points="360,300 512,300 512,455 270,455" fill="#2f6fd6" />
            <polygon points="512,300 664,300 754,455 512,455" fill="#5097ff" />
            <polygon points="270,455 512,455 512,760" fill="#1b4aa6" />
            <polygon points="512,455 754,455 512,760" fill="#2c66cf" />
            <polygon points="360,300 664,300 612,343 412,343" fill="#7fb6ff" />
          </svg>
        </div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            class={`rail-btn${tab === id ? " active" : ""}`}
            title={label}
            onClick={() => setTab(id)}
          >
            <Icon size={20} />
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
      ) : tab === "calendar" ? (
        <CalendarTab ws={ws} />
      ) : (
        <Settings />
      )}
    </div>
  );
}
