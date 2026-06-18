import { Pr, fetchPrs } from "./github";
import { getNotifySettings, notify } from "./notify";

const CACHE_KEY = "sapphire.ciCache";

interface State {
  ci: Pr["ci"];
  review: Pr["review"];
  reviewReq: boolean;
  passStreak: number; // consecutive polls observed as "passing"
  passNotified: boolean; // already fired the ✅ for the current passing streak
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
  const firstRun = Object.keys(prev).length === 0;
  const next: Cache = {};
  let fired = 0;

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
      // Seed silently; mark already-green PRs notified so we never fire for work
      // that was already passing before we started watching.
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
    if (s.prFailed && newFail) {
      notify({ title: `❌ ${key}`, body: p.title, url: p.url });
      fired++;
    } else if (s.prFixed && p.ci === "passing" && passStreak >= 2 && !passNotified && was) {
      notify({ title: `✅ ${key}`, body: p.title, url: p.url });
      passNotified = true;
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

    next[key] = {
      ci: p.ci,
      review: p.review,
      reviewReq: p.review_requested_of_me,
      passStreak,
      passNotified,
    };
  }

  saveCache(next);
  return fired;
}
