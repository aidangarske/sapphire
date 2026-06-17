import { Pr, fetchPrs } from "./github";
import { getNotifySettings, notify } from "./notify";

const CACHE_KEY = "sapphire.ciCache";

interface State {
  ci: Pr["ci"];
  review: Pr["review"];
  reviewReq: boolean;
}
type Cache = Record<string, State>;

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveCache(c: Cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(c));
}

// Returns the number of notifications fired. Pass announceExisting=true to also
// notify about PRs that are *already* failing/changes-requested (used by the
// manual "Check now" so you can verify alerts without waiting for a transition).
export async function runWatcherTick(announceExisting = false): Promise<number> {
  let prs: Pr[];
  try {
    prs = await fetchPrs();
  } catch {
    return 0;
  }

  const s = getNotifySettings();
  const prev = loadCache();
  const next: Cache = {};
  for (const p of prs) {
    next[`${p.repo}#${p.number}`] = {
      ci: p.ci,
      review: p.review,
      reviewReq: p.review_requested_of_me,
    };
  }

  const firstRun = Object.keys(prev).length === 0;
  // First run seeds silently so we don't fire for everything already in flight,
  // unless the caller explicitly wants the current failing state announced.
  if (firstRun && !announceExisting) {
    saveCache(next);
    return 0;
  }

  let fired = 0;
  for (const p of prs) {
    const key = `${p.repo}#${p.number}`;
    const was = prev[key];
    const newFail = p.ci === "failing" && (announceExisting || was?.ci !== "failing");
    if (s.prFailed && newFail) {
      notify({ title: `❌ ${key}`, body: p.title, url: p.url });
      fired++;
    } else if (s.prFixed && p.ci === "passing" && was !== undefined && was.ci !== "passing") {
      notify({ title: `✅ ${key}`, body: p.title, url: p.url });
      fired++;
    }
    if (
      s.prChangesRequested &&
      p.review === "changes_requested" &&
      (announceExisting || was?.review !== "changes_requested")
    ) {
      notify({ title: `${key} — changes requested`, body: p.title, url: p.url });
      fired++;
    }
    if (s.prReviewRequested && p.review_requested_of_me && (announceExisting || !was?.reviewReq)) {
      notify({ title: `${key} — review requested`, body: p.title, url: p.url });
      fired++;
    }
  }

  saveCache(next);
  return fired;
}
