import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export interface NotifySettings {
  prFailed: boolean;
  prFixed: boolean;
  prReviewRequested: boolean;
  prChangesRequested: boolean;
  calendar: boolean;
  leadMin: number;
}

const KEY = "sapphire.notify";

const DEFAULTS: NotifySettings = {
  prFailed: true,
  prFixed: true,
  prReviewRequested: true,
  prChangesRequested: true,
  calendar: true,
  leadMin: 15,
};

export function getNotifySettings(): NotifySettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function setNotifySettings(s: NotifySettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export async function ensurePermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  return granted;
}

export async function notify(o: { title: string; body: string; url?: string }) {
  // The Tauri plugin's desktop banner has no click callback, so for a notification
  // that should open something we use terminal-notifier (opens the URL on click).
  if (o.url) {
    try {
      const opened = await invoke<boolean>("notify_open", {
        title: o.title,
        body: o.body,
        url: o.url,
      });
      if (opened) return;
    } catch {
      /* fall through to the plain banner */
    }
  }
  if (!(await ensurePermission())) return;
  sendNotification({ title: o.title, body: o.body });
}

// Kept for callers; click-to-open is handled natively by terminal-notifier now.
export function wireNotificationClicks() {}
