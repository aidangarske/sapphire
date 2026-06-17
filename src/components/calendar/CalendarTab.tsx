import { useEffect, useRef, useState } from "preact/hooks";
import {
  RefreshCw,
  CalendarDays,
  LogIn,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-preact";
import {
  CalEvent,
  fetchEvents,
  googleLogin,
  googleStatus,
  hasGoogleClient,
  hasIcal,
} from "../../lib/calendar";
import { openExternal } from "../../lib/github";
import { addBoardTask } from "../../lib/store";

const CACHE = "sapphire.calCache";
const REFRESH_MS = 5 * 60 * 1000;
const HOUR_H = 60;

function readCache(): CalEvent[] | null {
  try {
    const c = localStorage.getItem(CACHE);
    return c ? (JSON.parse(c) as CalEvent[]) : null;
  } catch {
    return null;
  }
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

function dayLabel(ms: number): string {
  const diff = Math.round((startOfDay(ms) - startOfDay(Date.now())) / 86400000);
  const date = new Date(ms).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  if (diff === 0) return `Today · ${date}`;
  if (diff === 1) return `Tomorrow · ${date}`;
  if (diff === -1) return `Yesterday · ${date}`;
  return date;
}

const shortDay = (ms: number) => {
  const diff = Math.round((startOfDay(ms) - startOfDay(Date.now())) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fmtHour = (h: number) => `${h % 12 || 12} ${h < 12 || h === 24 ? "AM" : "PM"}`;
const toDateStr = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function CalendarTab({ ws }: { ws: string }) {
  const [events, setEvents] = useState<CalEvent[] | null>(readCache);
  const [setup, setSetup] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState(startOfDay(Date.now()));
  const [added, setAdded] = useState<Set<string>>(new Set());
  const lastSync = useRef("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const ev = await fetchEvents();
      setEvents(ev);
      localStorage.setItem(CACHE, JSON.stringify(ev));
      lastSync.current = new Date().toLocaleTimeString();
    } catch (e) {
      setError(`Couldn't load calendar (${String(e)}).`);
    } finally {
      setLoading(false);
    }
  }

  async function init() {
    setSetup(false);
    if (!hasIcal()) {
      const s = await googleStatus();
      if (s !== "ok") {
        setSetup(true);
        return false;
      }
    }
    load();
    return true;
  }

  async function signIn() {
    setSigningIn(true);
    setError(null);
    try {
      await googleLogin();
      await init();
    } catch (e) {
      setError(`Sign-in failed (${String(e)}).`);
    } finally {
      setSigningIn(false);
    }
  }

  useEffect(() => {
    let timer: number | undefined;
    const onFocus = () => load();
    init().then((ready) => {
      if (!ready) return;
      timer = window.setInterval(load, REFRESH_MS);
      window.addEventListener("focus", onFocus);
    });
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTask(e: CalEvent) {
    await addBoardTask(ws, `${e.summary} #cal`, { due: toDateStr(e.start) });
    setAdded(new Set(added).add(e.uid));
  }

  if (setup) {
    return (
      <main class="main" style={{ gridColumn: "2 / 4" }}>
        <div class="login">
          <div class="login-card">
            <div class="login-logo">
              <CalendarDays size={34} />
            </div>
            <h1>Connect Calendar</h1>
            {hasGoogleClient() ? (
              <>
                <p class="login-sub">
                  Sign in with Google to load your calendar (opens your browser).
                </p>
                <button class="btn primary" onClick={signIn} disabled={signingIn}>
                  <LogIn size={16} /> {signingIn ? "Waiting for browser…" : "Sign in with Google"}
                </button>
              </>
            ) : (
              <>
                <p class="login-sub">
                  Add a Google OAuth <b>Desktop</b> client in Settings (Cmd+5) first. See the setup
                  guide in Docs/CALENDAR-SETUP.md.
                </p>
                <button
                  class="btn"
                  onClick={() => openExternal("https://console.cloud.google.com/apis/credentials")}
                >
                  <ExternalLink size={15} /> Open Google Cloud Console
                </button>
              </>
            )}
            {error && <p class="login-status">{error}</p>}
            <p class="login-status">
              Prefer a personal calendar? Paste a secret iCal URL in Settings.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const todayStart = startOfDay(Date.now());
  const days = Array.from({ length: 7 }, (_, i) => todayStart + i * 86400000);
  const countFor = (d: number) => (events ?? []).filter((e) => startOfDay(e.start) === d).length;

  const dayEnd = day + 86400000;
  const allDay = (events ?? []).filter((e) => e.allDay && e.start < dayEnd && e.end > day);
  const timed = (events ?? [])
    .filter((e) => !e.allDay && e.start < dayEnd && e.end > day)
    .sort((a, b) => a.start - b.start);

  // visible hour range (auto-expanded to fit the day's events, clamped to the day)
  let startHour = 8;
  let endHour = 18;
  for (const e of timed) {
    const sMin = Math.max(0, (e.start - day) / 60000);
    const eMin = Math.min(1440, (e.end - day) / 60000);
    startHour = Math.min(startHour, Math.floor(sMin / 60));
    endHour = Math.max(endHour, Math.ceil(eMin / 60));
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  const hours = endHour - startHour;

  // lane layout for overlapping events
  type Laid = { e: CalEvent; col: number; ncols: number };
  const laid: Laid[] = [];
  let cluster: CalEvent[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols: number[] = [];
    const assigned: { e: CalEvent; col: number }[] = [];
    for (const e of cluster) {
      let c = cols.findIndex((end) => end <= e.start);
      if (c < 0) {
        c = cols.length;
        cols.push(e.end);
      } else cols[c] = e.end;
      assigned.push({ e, col: c });
    }
    for (const a of assigned) laid.push({ ...a, ncols: cols.length });
    cluster = [];
    clusterEnd = -1;
  };
  for (const e of timed) {
    if (cluster.length && e.start >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.end);
  }
  if (cluster.length) flush();

  const blockStyle = (l: Laid) => {
    const startMin = Math.max(0, (l.e.start - day) / 60000) - startHour * 60;
    const endMin = Math.min(1440, (l.e.end - day) / 60000) - startHour * 60;
    const top = (startMin / 60) * HOUR_H;
    const height = Math.max(26, ((endMin - startMin) / 60) * HOUR_H - 3);
    const width = 100 / l.ncols;
    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${l.col * width}%`,
      width: `calc(${width}% - 4px)`,
    };
  };

  return (
    <>
      <aside class="list">
        <div class="list-title">Calendar</div>
        <div class="cal-days">
          {days.map((d) => (
            <button
              key={d}
              class={`cal-day-pick${d === day ? " active" : ""}`}
              onClick={() => setDay(d)}
            >
              <span>{shortDay(d)}</span>
              {countFor(d) > 0 && <span class="board-count">{countFor(d)}</span>}
            </button>
          ))}
        </div>
        {lastSync.current && <div class="synced">Synced {lastSync.current}</div>}
      </aside>

      <main class="main cal-main">
        <div class="pr-toolbar">
          <button class="icon-btn" title="Previous day" onClick={() => setDay(day - 86400000)}>
            <ChevronLeft size={16} />
          </button>
          <button class="icon-btn" title="Next day" onClick={() => setDay(day + 86400000)}>
            <ChevronRight size={16} />
          </button>
          <button
            class="btn ghost"
            style={{ padding: "5px 10px" }}
            onClick={() => setDay(todayStart)}
          >
            Today
          </button>
          <div class="cal-title">{dayLabel(day)}</div>
          <button class="icon-btn" title="Refresh" onClick={load} disabled={loading}>
            <RefreshCw size={15} class={loading ? "spin" : ""} />
          </button>
        </div>

        {error && <div class="banner">{error}</div>}

        {allDay.length > 0 && (
          <div class="cal-allday">
            {allDay.map((e) => (
              <span class="cal-allday-pill" key={e.uid}>
                {e.summary}
                <button class="cal-add" title="Add to tasks" onClick={() => addTask(e)}>
                  {added.has(e.uid) ? "✓" : <Plus size={12} />}
                </button>
              </span>
            ))}
          </div>
        )}

        <div class="cal-day-view">
          {timed.length === 0 && allDay.length === 0 && (
            <div class="cal-empty">Nothing scheduled</div>
          )}
          <div class="cal-grid" style={{ height: `${hours * HOUR_H}px` }}>
            <div class="cal-gutter">
              {Array.from({ length: hours + 1 }, (_, i) => startHour + i).map((h) => (
                <div class="cal-gutter-h" key={h} style={{ top: `${(h - startHour) * HOUR_H}px` }}>
                  {fmtHour(h)}
                </div>
              ))}
            </div>
            <div class="cal-track">
              {Array.from({ length: hours + 1 }, (_, i) => i).map((i) => (
                <div class="cal-line" key={i} style={{ top: `${i * HOUR_H}px` }} />
              ))}
              {laid.map((l) => (
                <div class="cal-block" key={l.e.uid} style={blockStyle(l)}>
                  <div
                    class="cal-block-body"
                    onClick={() => (l.e.url || l.e.link) && openExternal(l.e.url || l.e.link!)}
                  >
                    <div class="cal-block-title">{l.e.summary}</div>
                    <div class="cal-block-time">
                      {fmtTime(l.e.start)} – {fmtTime(l.e.end)}
                    </div>
                  </div>
                  <div class="cal-block-actions">
                    {l.e.url && (
                      <button class="cal-mini" title="Join" onClick={() => openExternal(l.e.url!)}>
                        join
                      </button>
                    )}
                    <button class="cal-mini" title="Add to tasks" onClick={() => addTask(l.e)}>
                      {added.has(l.e.uid) ? "✓" : "+task"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
