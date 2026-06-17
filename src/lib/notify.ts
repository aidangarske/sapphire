import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  onAction,
} from "@tauri-apps/plugin-notification";
import { openExternal } from "./github";

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
  if (!(await ensurePermission())) return;
  sendNotification({
    title: o.title,
    body: o.body,
    ...(o.url ? { extra: { url: o.url } } : {}),
  } as never);
}

let wired = false;
export function wireNotificationClicks() {
  if (wired) return;
  wired = true;
  onAction((n: any) => {
    const url = n?.extra?.url ?? n?.notification?.extra?.url ?? n?.userInfo?.url;
    if (url) openExternal(url);
  }).catch(() => {});
}
