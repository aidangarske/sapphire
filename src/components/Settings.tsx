import { useEffect, useState } from "preact/hooks";
import { Account, githubAccount, githubStatus } from "../lib/github";
import { getWorkspace } from "../lib/store";
import { getDailyNoteName, setDailyNoteName } from "../lib/journal";
import { NotifySettings, getNotifySettings, setNotifySettings } from "../lib/notify";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { runWatcherTick } from "../lib/watcher";
import {
  UpdateStatus,
  checkUpdate,
  findRepoDir,
  getRepoDir,
  relaunchApp,
  runUpdate,
  setRepoDir as storeRepoDir,
} from "../lib/updater";
import {
  Layout,
  NOTE_TEXT_CHOICES,
  THEMES,
  getListLayout,
  getMainLayout,
  getNoteText,
  getThemeId,
  setListLayout,
  setMainLayout,
  setNoteText,
  setThemeId,
} from "../lib/theme";

export default function Settings() {
  const [status, setStatus] = useState<string>("");
  const [account, setAccount] = useState<Account | null>(null);
  const [notif, setNotif] = useState<NotifySettings>(getNotifySettings());
  const [notifMsg, setNotifMsg] = useState("");
  const [dailyNote, setDailyNote] = useState(getDailyNoteName());
  const [dailyMsg, setDailyMsg] = useState("");
  const [repoDir, setRepoDir] = useState(getRepoDir());
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [updateOk, setUpdateOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [statusErr, setStatusErr] = useState("");

  async function doCheck() {
    const dir = repoDir.trim();
    if (!dir) {
      setStatusErr("Set the path to your Sapphire source checkout first.");
      return;
    }
    storeRepoDir(dir);
    setChecking(true);
    setStatusErr("");
    setUpdateStatus(null);
    try {
      setUpdateStatus(await checkUpdate(dir));
    } catch (e) {
      setStatusErr(String(e));
    } finally {
      setChecking(false);
    }
  }
  const [themeId, setThemeState] = useState(getThemeId());
  const [mainLayout, setMainLayoutState] = useState<Layout>(getMainLayout());
  const [listLayout, setListLayoutState] = useState<Layout>(getListLayout());
  const [noteText, setNoteTextState] = useState(getNoteText());

  function pickNoteText(value: string) {
    setNoteTextState(value);
    setNoteText(value);
  }

  function pickTheme(id: string) {
    setThemeState(id);
    setThemeId(id);
  }

  function pickMain(l: Layout) {
    setMainLayoutState(l);
    setMainLayout(l);
  }

  function pickList(l: Layout) {
    setListLayoutState(l);
    setListLayout(l);
  }

  async function doUpdate() {
    const dir = repoDir.trim();
    if (!dir) {
      setUpdateOk(false);
      setUpdateLog(["Set the path to your Sapphire source checkout first."]);
      return;
    }
    storeRepoDir(dir);
    setUpdating(true);
    setUpdateOk(null);
    setUpdateLog([`Updating from ${dir}…`]);
    await runUpdate(
      dir,
      (line) => setUpdateLog((l) => [...l, line]),
      (ok) => {
        setUpdating(false);
        setUpdateOk(ok);
      },
    );
  }

  function saveDaily() {
    setDailyNoteName(dailyNote);
    setDailyMsg(`Daily log will append to "${dailyNote.trim() || "Daily Notes"}".`);
  }

  function updateNotif(patch: Partial<NotifySettings>) {
    const n = { ...notif, ...patch };
    setNotif(n);
    setNotifySettings(n);
  }

  async function testNotify() {
    setNotifMsg("Checking permission…");
    try {
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (!granted) {
        setNotifMsg(
          "Permission not granted — enable in System Settings → Notifications → Sapphire.",
        );
        return;
      }
      await sendNotification({ title: "Sapphire", body: "Test notification ✅" });
      setNotifMsg("Sent. No banner? Check Notification Center (top-right clock).");
    } catch (e) {
      setNotifMsg(`Failed: ${String(e)}`);
    }
  }

  async function checkPRs() {
    setNotifMsg("Checking your PRs…");
    const n = await runWatcherTick(true);
    setNotifMsg(
      n > 0
        ? `Fired ${n} PR alert(s).`
        : "No PRs match your enabled alerts right now (or you're not signed into gh).",
    );
  }

  useEffect(() => {
    githubStatus().then(async (s) => {
      setStatus(s);
      if (s === "ok") setAccount(await githubAccount());
    });
    if (!getRepoDir()) findRepoDir().then((d) => d && setRepoDir(d));
  }, []);

  return (
    <>
      <aside class="list">
        <div class="list-title">Settings</div>
      </aside>
      <main class="main settings-main">
        <div class="settings">
          <section class="settings-card">
          <h2>Appearance</h2>
          <p class="settings-help">
            Pick a skin to recolor the whole app. Changes apply instantly.
          </p>
          <div class="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                class={`theme-card${themeId === t.id ? " active" : ""}`}
                title={t.name}
                onClick={() => pickTheme(t.id)}
              >
                <div class="theme-swatches">
                  <span style={{ background: t.vars["bg-0"] }} />
                  <span style={{ background: t.vars["bg-2"] }} />
                  <span style={{ background: t.vars["accent"] }} />
                  <span style={{ background: t.vars["ok"] }} />
                  <span style={{ background: t.vars["bad"] }} />
                </div>
                <span class="theme-name">{t.name}</span>
              </button>
            ))}
          </div>

          <h3 class="settings-sub">Layout</h3>
          <p class="settings-help">
            Orient the main navigation and the secondary list (notes list, task boards, PR
            categories) independently.
          </p>
          <div class="layout-grid">
            <span class="layout-label">Main nav</span>
            <div class="seg">
              <button
                class={`seg-btn${mainLayout === "vertical" ? " active" : ""}`}
                onClick={() => pickMain("vertical")}
              >
                Vertical
              </button>
              <button
                class={`seg-btn${mainLayout === "horizontal" ? " active" : ""}`}
                onClick={() => pickMain("horizontal")}
              >
                Horizontal
              </button>
            </div>
            <span class="layout-label">Secondary list</span>
            <div class="seg">
              <button
                class={`seg-btn${listLayout === "vertical" ? " active" : ""}`}
                onClick={() => pickList("vertical")}
              >
                Vertical
              </button>
              <button
                class={`seg-btn${listLayout === "horizontal" ? " active" : ""}`}
                onClick={() => pickList("horizontal")}
              >
                Horizontal
              </button>
            </div>
          </div>

          <h3 class="settings-sub">Note text</h3>
          <p class="settings-help">Brighten or recolor the note reading/editing text.</p>
          <div class="seg">
            {NOTE_TEXT_CHOICES.map((c) => (
              <button
                key={c.id}
                class={`seg-btn${noteText === c.value ? " active" : ""}`}
                onClick={() => pickNoteText(c.value)}
              >
                {c.value ? (
                  <span class="note-text-dot" style={{ background: c.value }} />
                ) : null}
                {c.label}
              </button>
            ))}
          </div>
          </section>

          <section class="settings-card">
          <h2>GitHub</h2>
          {status === "ok" && account ? (
            <p class="settings-help">
              Signed in as <b>@{account.login}</b> via the GitHub CLI. Nothing to configure.
            </p>
          ) : status === "gh-missing" ? (
            <p class="settings-help">
              GitHub CLI not found. Install it with <code>brew install gh</code> then{" "}
              <code>gh auth login</code>.
            </p>
          ) : (
            <p class="settings-help">
              Not signed in. Run <code>gh auth login</code> in your terminal — Sapphire uses your
              GitHub CLI session, no token needed.
            </p>
          )}

          </section>

          <section class="settings-card">
          <h2>Notifications</h2>
          <p class="settings-help">
            Choose what to be alerted about. (macOS delivers these in the built app — not in{" "}
            <code>tauri dev</code>.)
          </p>
          <div class="notif-list">
            <label class="notif-row">
              <input
                type="checkbox"
                checked={notif.prFailed}
                onChange={(e) => updateNotif({ prFailed: e.currentTarget.checked })}
              />
              PR CI failed
            </label>
            <label class="notif-row">
              <input
                type="checkbox"
                checked={notif.prFixed}
                onChange={(e) => updateNotif({ prFixed: e.currentTarget.checked })}
              />
              PR CI fixed
            </label>
            <label class="notif-row">
              <input
                type="checkbox"
                checked={notif.prReviewRequested}
                onChange={(e) => updateNotif({ prReviewRequested: e.currentTarget.checked })}
              />
              Review requested of me
            </label>
            <label class="notif-row">
              <input
                type="checkbox"
                checked={notif.prChangesRequested}
                onChange={(e) => updateNotif({ prChangesRequested: e.currentTarget.checked })}
              />
              Changes requested on my PR
            </label>
          </div>
          <button class="btn" style={{ marginTop: "12px" }} onClick={testNotify}>
            Send test notification
          </button>
          <button class="btn" style={{ marginTop: "12px", marginLeft: "8px" }} onClick={checkPRs}>
            Check PRs now
          </button>
          {notifMsg && <div class="settings-msg">{notifMsg}</div>}

          </section>

          <section class="settings-card">
          <h2>Daily log</h2>
          <p class="settings-help">
            Board activity (done / blocked / in progress) is appended to this note each day. Name it
            whatever your daily note is called — it's created if it doesn't exist.
          </p>
          <div class="settings-row">
            <input
              placeholder="Daily Notes"
              value={dailyNote}
              onInput={(e) => setDailyNote(e.currentTarget.value)}
            />
            <button class="btn" onClick={saveDaily}>
              Save
            </button>
          </div>
          {dailyMsg && <div class="settings-msg">{dailyMsg}</div>}

          </section>

          <section class="settings-card">
          <h2>App updates</h2>
          <p class="settings-help">
            Pulls the latest code from GitHub and rebuilds Sapphire, replacing the copy in{" "}
            <code>/Applications</code>. Needs your local source checkout plus the Node and Rust
            toolchains. Local uncommitted changes block the pull (nothing is overwritten).
          </p>
          <div class="settings-row">
            <input
              placeholder="~/sapphire"
              value={repoDir}
              onInput={(e) => setRepoDir(e.currentTarget.value)}
            />
            <button class="btn ghost" onClick={doCheck} disabled={checking || updating}>
              {checking ? "Checking…" : "Check for updates"}
            </button>
            <button class="btn" onClick={doUpdate} disabled={updating}>
              {updating ? "Updating…" : "Update now"}
            </button>
          </div>
          {updateStatus &&
            (updateStatus.behind > 0 ? (
              <div class="settings-msg update-avail">
                Update available — {updateStatus.behind} commit
                {updateStatus.behind === 1 ? "" : "s"} behind ({updateStatus.current} →{" "}
                {updateStatus.latest}). Latest: {updateStatus.subject}
              </div>
            ) : (
              <div class="settings-msg">
                Up to date ({updateStatus.current}).
                {updateStatus.ahead > 0 &&
                  ` You're ${updateStatus.ahead} commit${updateStatus.ahead === 1 ? "" : "s"} ahead of origin.`}
              </div>
            ))}
          {statusErr && <div class="settings-msg update-err">{statusErr}</div>}
          {updateLog.length > 0 && <pre class="update-log">{updateLog.join("\n")}</pre>}
          {updateOk === true && (
            <div class="settings-msg">
              Updated.{" "}
              <button class="btn" style={{ marginLeft: "6px" }} onClick={() => relaunchApp()}>
                Restart Sapphire
              </button>
            </div>
          )}
          {updateOk === false && (
            <div class="settings-msg">Update did not complete — see the log above.</div>
          )}

          </section>

          <section class="settings-card">
          <h2>Workspace</h2>
          <p class="settings-help">{getWorkspace() ?? "No workspace selected."}</p>
          </section>
        </div>
      </main>
    </>
  );
}
