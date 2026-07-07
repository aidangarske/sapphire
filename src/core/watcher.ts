import type { Pr } from "./github/types.ts";

export interface NotifySettings {
  prFailed: boolean;
  prFixed: boolean;
  prReviewRequested: boolean;
  prChangesRequested: boolean;
}

export const NOTIFY_DEFAULTS: NotifySettings = {
  prFailed: true,
  prFixed: true,
  prReviewRequested: true,
  prChangesRequested: true,
};

export interface PrState {
  ci: Pr["ci"];
  review: Pr["review"];
  reviewReq: boolean;
  passStreak: number; // consecutive polls observed as "passing"
  passNotified: boolean; // already fired the pass alert for this streak
}
export type CiCache = Record<string, PrState>;

export interface NotifyEvent {
  title: string;
  body: string;
  url: string;
}

// Pure transition diff ported from watcher.ts::runWatcherTick. Given the previous
// cache and the freshly-fetched PRs, returns the notifications to fire and the
// next cache to persist. No I/O, no notify() call — the service layer delivers.
export function diffTick(
  prev: CiCache,
  prs: Pr[],
  settings: NotifySettings,
  announceExisting = false,
): { events: NotifyEvent[]; nextCache: CiCache } {
  const firstRun = Object.keys(prev).length === 0;
  const next: CiCache = {};
  const events: NotifyEvent[] = [];

  for (const p of prs) {
    const key = `${p.repo}#${p.number}`;
    const was = prev[key];
    const wasPassing = was?.ci === "passing";
    // statusCheckRollup briefly reports SUCCESS while checks are still being
    // registered, so only treat "passing" as real once it holds for two polls.
    const passStreak = p.ci === "passing" ? (wasPassing ? (was?.passStreak ?? 0) : 0) + 1 : 0;
    let passNotified =
      p.ci === "passing" ? (wasPassing ? (was?.passNotified ?? false) : false) : false;

    if (firstRun && !announceExisting) {
      next[key] = {
        ci: p.ci,
        review: p.review,
        reviewReq: p.review_requested_of_me,
        passStreak,
        passNotified: p.ci === "passing",
      };
      continue;
    }

    const newFail = p.ci === "failing" && (announceExisting || was?.ci !== "failing");
    if (settings.prFailed && newFail) {
      events.push({ title: `❌ ${key}`, body: p.title, url: p.url });
    } else if (settings.prFixed && p.ci === "passing" && passStreak >= 2 && !passNotified && was) {
      events.push({ title: `✅ ${key}`, body: p.title, url: p.url });
      passNotified = true;
    }
    if (
      settings.prChangesRequested &&
      p.review === "changes_requested" &&
      (announceExisting || was?.review !== "changes_requested")
    ) {
      events.push({ title: `${key} — changes requested`, body: p.title, url: p.url });
    }
    if (
      settings.prReviewRequested &&
      p.review_requested_of_me &&
      (announceExisting || !was?.reviewReq)
    ) {
      events.push({ title: `${key} — review requested`, body: p.title, url: p.url });
    }

    next[key] = {
      ci: p.ci,
      review: p.review,
      reviewReq: p.review_requested_of_me,
      passStreak,
      passNotified,
    };
  }

  return { events, nextCache: next };
}
