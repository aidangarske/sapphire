import { invoke } from "@tauri-apps/api/core";

export interface CalEvent {
  uid: string;
  summary: string;
  start: number; // epoch ms
  end: number;
  allDay: boolean;
  url?: string; // google meet link
  link?: string; // event page
}

const KEY = "sapphire.icalUrl";

export const getIcalUrl = () => localStorage.getItem(KEY) ?? "";
export const setIcalUrl = (u: string) => localStorage.setItem(KEY, u.trim());
export const hasIcal = () => getIcalUrl().length > 0;

export interface GClient {
  clientId: string;
  clientSecret: string;
}
const GKEY = "sapphire.googleClient";
export function getGoogleClient(): GClient {
  try {
    const j = JSON.parse(localStorage.getItem(GKEY) ?? "{}");
    return { clientId: j.clientId ?? "", clientSecret: j.clientSecret ?? "" };
  } catch {
    return { clientId: "", clientSecret: "" };
  }
}
export function setGoogleClient(c: GClient) {
  localStorage.setItem(
    GKEY,
    JSON.stringify({ clientId: c.clientId.trim(), clientSecret: c.clientSecret.trim() }),
  );
}
export const hasGoogleClient = () => getGoogleClient().clientId.length > 0;

export const googleStatus = () => invoke<string>("google_status");
export const googleLogin = () => {
  const c = getGoogleClient();
  return invoke<void>("google_oauth_login", { clientId: c.clientId, clientSecret: c.clientSecret });
};

export async function calendarReady(): Promise<boolean> {
  if (hasIcal()) return true;
  try {
    return (await googleStatus()) === "ok";
  } catch {
    return false;
  }
}

// Google returns all-day events as date-only strings ("2026-06-17"); `new Date()`
// reads those as UTC midnight, so parse them as local calendar dates instead.
export function parseGoogleDate(value: string, allDay: boolean): number {
  if (allDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  return new Date(value).getTime();
}

async function fetchGoogle(daysAhead: number): Promise<CalEvent[]> {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const timeMin = rangeStart.toISOString();
  const timeMax = new Date(rangeStart.getTime() + daysAhead * 86400000).toISOString();
  const raw = await invoke<
    {
      id?: string;
      summary: string;
      start: string;
      end: string;
      all_day: boolean;
      url?: string;
      link?: string;
    }[]
  >("google_calendar", { timeMin, timeMax });
  return raw.map((r) => ({
    uid: r.id || `${r.summary}-${r.start}-${r.link ?? ""}`,
    summary: r.summary,
    start: parseGoogleDate(r.start, r.all_day),
    end: parseGoogleDate(r.end || r.start, r.all_day),
    allDay: r.all_day,
    url: r.url || undefined,
    link: r.link || undefined,
  }));
}

async function fetchIcal(daysAhead: number): Promise<CalEvent[]> {
  const ics = await invoke<string>("fetch_ics", { url: getIcalUrl() });
  const mod: any = await import("ical.js");
  const ICAL = mod.default ?? mod;

  const comp = new ICAL.Component(ICAL.parse(ics));
  const vevents = comp.getAllSubcomponents("vevent");

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rangeEnd = new Date(rangeStart.getTime() + daysAhead * 86400000);
  const endT = ICAL.Time.fromJSDate(rangeEnd, false);
  const out: CalEvent[] = [];

  for (const ve of vevents) {
    const event = new ICAL.Event(ve);
    let allDay = false;
    try {
      allDay = event.startDate.isDate;
    } catch {
      continue;
    }

    const blob = ["description", "location", "url"]
      .map((p) => String(ve.getFirstPropertyValue(p) ?? ""))
      .join(" ");
    const meet = blob.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i)?.[0];
    const evUrl = meet ?? (String(ve.getFirstPropertyValue("url") ?? "") || undefined);

    const push = (s: number, e: number, key: string) => {
      if (e >= rangeStart.getTime() && s <= rangeEnd.getTime()) {
        out.push({
          uid: key,
          summary: event.summary || "(no title)",
          start: s,
          end: e,
          allDay,
          url: evUrl,
        });
      }
    };

    if (event.isRecurring()) {
      const it = event.iterator();
      let next;
      let guard = 0;
      let emitted = 0;
      while ((next = it.next())) {
        if (guard++ > 100000) break; // safety bound; never loop unbounded
        if (next.compare(endT) > 0) break;
        const det = event.getOccurrenceDetails(next);
        const s = det.startDate.toJSDate().getTime();
        const e = det.endDate.toJSDate().getTime();
        if (e < rangeStart.getTime()) continue; // earlier than our window — skip
        push(s, e, `${event.uid}-${guard}`);
        if (++emitted > 1000) break;
      }
    } else {
      push(
        event.startDate.toJSDate().getTime(),
        event.endDate.toJSDate().getTime(),
        event.uid || `${out.length}`,
      );
    }
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}

export async function fetchEvents(daysAhead = 14): Promise<CalEvent[]> {
  if (hasIcal()) return fetchIcal(daysAhead);
  return fetchGoogle(daysAhead);
}
