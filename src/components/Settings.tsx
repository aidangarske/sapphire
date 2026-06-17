import { useEffect, useState } from "preact/hooks";
import { Account, githubAccount, githubStatus } from "../lib/github";
import { getWorkspace } from "../lib/store";
import { getGoogleClient, getIcalUrl, setGoogleClient, setIcalUrl } from "../lib/calendar";
import { getDailyNoteName, setDailyNoteName } from "../lib/journal";
import { NotifySettings, getNotifySettings, setNotifySettings } from "../lib/notify";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { runWatcherTick } from "../lib/watcher";

export default function Settings() {
  const [status, setStatus] = useState<string>("");
  const [account, setAccount] = useState<Account | null>(null);
  const [ical, setIcal] = useState(getIcalUrl());
  const [calMsg, setCalMsg] = useState("");
  const [gclient, setGclient] = useState(getGoogleClient());
  const [gMsg, setGMsg] = useState("");
  const [notif, setNotif] = useState<NotifySettings>(getNotifySettings());
  const [notifMsg, setNotifMsg] = useState("");
  const [dailyNote, setDailyNote] = useState(getDailyNoteName());
  const [dailyMsg, setDailyMsg] = useState("");

  function saveDaily() {
    setDailyNoteName(dailyNote);
    setDailyMsg(`Daily log will append to "${dailyNote.trim() || "Daily Notes"}".`);
  }

  function saveGoogle() {
    setGoogleClient(gclient);
    setGMsg("Saved. Now click Sign in on the Calendar tab.");
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
  }, []);

  function saveCalendar() {
    setIcalUrl(ical);
    setCalMsg("Saved. Open the Calendar tab (Cmd+4).");
  }

  return (
    <>
      <aside class="list">
        <div class="list-title">Settings</div>
      </aside>
      <main class="main settings-main">
        <div class="settings">
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

          <h2 style={{ marginTop: "30px" }}>Notifications</h2>
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
            <label class="notif-row">
              <input
                type="checkbox"
                checked={notif.calendar}
                onChange={(e) => updateNotif({ calendar: e.currentTarget.checked })}
              />
              Calendar event reminders
            </label>
            <label class="notif-row">
              Remind
              <input
                class="notif-num"
                type="number"
                min={1}
                max={120}
                value={notif.leadMin}
                onInput={(e) => updateNotif({ leadMin: Number(e.currentTarget.value) || 15 })}
              />
              min before events
            </label>
          </div>
          <button class="btn" style={{ marginTop: "12px" }} onClick={testNotify}>
            Send test notification
          </button>
          <button class="btn" style={{ marginTop: "12px", marginLeft: "8px" }} onClick={checkPRs}>
            Check PRs now
          </button>
          {notifMsg && <div class="settings-msg">{notifMsg}</div>}

          <h2 style={{ marginTop: "30px" }}>Daily log</h2>
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

          <h2 style={{ marginTop: "30px" }}>Google Calendar</h2>
          <p class="settings-help">
            Create a Google OAuth <b>Desktop</b> client (Google Cloud Console → APIs &amp; Services
            → Credentials → OAuth client ID → Desktop app) and enable the <b>Calendar API</b>. Paste
            its ID and secret, then click <b>Sign in</b> on the Calendar tab. Stored locally.
          </p>
          <div class="settings-row">
            <input
              placeholder="OAuth Client ID"
              value={gclient.clientId}
              onInput={(e) => setGclient({ ...gclient, clientId: e.currentTarget.value })}
            />
          </div>
          <div class="settings-row" style={{ marginTop: "8px" }}>
            <input
              type="password"
              placeholder="OAuth Client secret"
              value={gclient.clientSecret}
              onInput={(e) => setGclient({ ...gclient, clientSecret: e.currentTarget.value })}
            />
            <button class="btn" onClick={saveGoogle}>
              Save
            </button>
          </div>
          {gMsg && <div class="settings-msg">{gMsg}</div>}

          <p class="settings-help" style={{ marginTop: "16px" }}>
            Or, for a <b>personal</b> calendar, paste a secret iCal URL instead:
          </p>
          <div class="settings-row">
            <input
              type="password"
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              value={ical}
              onInput={(e) => setIcal(e.currentTarget.value)}
            />
            <button class="btn" onClick={saveCalendar}>
              Save
            </button>
          </div>
          {calMsg && <div class="settings-msg">{calMsg}</div>}

          <h2 style={{ marginTop: "30px" }}>Workspace</h2>
          <p class="settings-help">{getWorkspace() ?? "No workspace selected."}</p>
        </div>
      </main>
    </>
  );
}
