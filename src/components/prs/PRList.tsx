import { useEffect, useRef, useState } from "preact/hooks";
import { RefreshCw, ExternalLink, Plus } from "lucide-preact";
import {
  Account,
  Pr,
  fetchPrs,
  githubAccount,
  githubStatus,
  needsAttention,
  openExternal,
} from "../../lib/github";
import Login from "./Login";

const PR_CACHE = "sapphire.prsCache";
const ACC_CACHE = "sapphire.acctCache";
const REFRESH_MS = 60 * 1000;

const CATS: { key: string; label: string; test: (p: Pr) => boolean }[] = [
  { key: "created", label: "Created", test: (p) => p.authored },
  { key: "attention", label: "Needs attention", test: needsAttention },
  { key: "review", label: "Review requested", test: (p) => p.review_requested_of_me },
  { key: "assigned", label: "Assigned", test: (p) => p.assigned },
];

const CAT_KEYS: Record<string, number> = { a: 0, s: 1, d: 2, f: 3 };

function readCache<T>(key: string): T | null {
  try {
    const c = localStorage.getItem(key);
    return c ? (JSON.parse(c) as T) : null;
  } catch {
    return null;
  }
}

type Group = { title: string; prs: Pr[] };
function byStatus(prs: Pr[]): Group[] {
  const failing: Pr[] = [];
  const pending: Pr[] = [];
  const passing: Pr[] = [];
  const other: Pr[] = [];
  for (const p of prs) {
    if (p.ci === "failing") failing.push(p);
    else if (p.ci === "pending") pending.push(p);
    else if (p.ci === "passing") passing.push(p);
    else other.push(p);
  }
  return [
    { title: "Failing", prs: failing },
    { title: "Pending", prs: pending },
    { title: "Passing", prs: passing },
    { title: "No checks", prs: other },
  ].filter((g) => g.prs.length > 0);
}

const CI_LABEL: Record<Pr["ci"], string> = {
  failing: "failing",
  pending: "pending",
  passing: "passing",
  "no-checks": "no checks",
  unknown: "unknown",
};

export default function PRList({ onCreateTask }: { onCreateTask: (p: Pr) => void }) {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [account, setAccount] = useState<Account | null>(() => readCache<Account>(ACC_CACHE));
  const [prs, setPrs] = useState<Pr[] | null>(() => readCache<Pr[]>(PR_CACHE));
  const [loading, setLoading] = useState(false);
  const [repo, setRepo] = useState("all");
  const [cat, setCat] = useState(0);
  const lastSync = useRef<string>("");
  const okRef = useRef(false);

  async function load() {
    setLoading(true);
    try {
      const list = await fetchPrs();
      setPrs(list);
      localStorage.setItem(PR_CACHE, JSON.stringify(list));
      lastSync.current = new Date().toLocaleTimeString();
    } catch {
      /* keep showing cached data */
    } finally {
      setLoading(false);
    }
  }

  async function init() {
    const s = await githubStatus();
    setStatus(s);
    okRef.current = s === "ok";
    if (s === "ok") {
      githubAccount().then((a) => {
        if (a) {
          setAccount(a);
          localStorage.setItem(ACC_CACHE, JSON.stringify(a));
        }
      });
      load();
    }
  }

  useEffect(() => {
    init();
    const onFocus = () => okRef.current && load();
    const timer = window.setInterval(() => okRef.current && load(), REFRESH_MS);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
        const i = CAT_KEYS[e.key.toLowerCase()];
        if (i !== undefined) {
          e.preventDefault();
          setCat(i);
        }
        return;
      }
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      const d = e.code.match(/^Digit([1-9])$/);
      if (d) {
        const i = Number(d[1]) - 1;
        if (i < CATS.length) {
          e.preventDefault();
          setCat(i);
        }
        return;
      }
      if (e.code === "BracketRight" || e.code === "BracketLeft") {
        e.preventDefault();
        const dir = e.code === "BracketRight" ? 1 : -1;
        setCat((c) => (c + dir + CATS.length) % CATS.length);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  if (status !== undefined && status !== "ok") {
    return (
      <main class="main" style={{ gridColumn: "2 / 4" }}>
        <Login status={status as "not-authed" | "gh-missing"} onRecheck={init} />
      </main>
    );
  }

  if (!prs) {
    return (
      <main class="main" style={{ gridColumn: "2 / 4" }}>
        <div class="placeholder">Loading PRs…</div>
      </main>
    );
  }

  const repos = Array.from(new Set(prs.map((p) => p.repo))).sort();
  const inRepo = prs.filter((p) => repo === "all" || p.repo === repo);
  const visible = inRepo.filter(CATS[cat].test);
  const groups = byStatus(visible);

  return (
    <>
      <aside class="list pr-sidebar">
        {account && (
          <div class="account">
            {account.avatar_url && <img src={account.avatar_url} class="avatar" />}
            <div class="account-meta">
              <div class="account-name">{account.name || account.login}</div>
              <div class="account-login">@{account.login}</div>
            </div>
          </div>
        )}

        <div class="cat-tabs">
          {CATS.map((c, i) => (
            <button
              key={c.key}
              class={`cat-tab${cat === i ? " active" : ""}`}
              onClick={() => setCat(i)}
            >
              <span>{c.label}</span>
              <span class="board-count">{inRepo.filter(c.test).length}</span>
            </button>
          ))}
        </div>

        <select class="repo-select" value={repo} onChange={(e) => setRepo(e.currentTarget.value)}>
          <option value="all">All repositories</option>
          {repos.map((r) => (
            <option value={r} key={r}>
              {r}
            </option>
          ))}
        </select>

        {lastSync.current && <div class="synced">Synced {lastSync.current}</div>}
      </aside>

      <main class="main pr-main">
        <div class="pr-toolbar">
          <div class="list-title">{CATS[cat].label}</div>
          <button class="icon-btn" title="Refresh" onClick={load} disabled={loading}>
            <RefreshCw size={15} class={loading ? "spin" : ""} />
          </button>
        </div>

        {visible.length === 0 && <div class="placeholder">Nothing here 🎉</div>}

        <div class="pr-groups">
          {groups.map((g) => (
            <section class="pr-group" key={g.title}>
              <h3 class="pr-group-title">
                {g.title} <span class="board-count">{g.prs.length}</span>
              </h3>
              {g.prs.map((p) => (
                <article class="pr-row" key={p.url}>
                  <span class={`ci-dot ci-${p.ci}`} title={CI_LABEL[p.ci]} />
                  <div class="pr-main-col">
                    <div class="pr-title">
                      <span class="pr-repo">
                        {p.repo} #{p.number}
                      </span>
                      {p.draft && <span class="pr-badge">draft</span>}
                      {p.conflict && <span class="pr-badge bad">conflict</span>}
                      {p.review === "changes_requested" && (
                        <span class="pr-badge bad">changes requested</span>
                      )}
                      {p.review === "approved" && <span class="pr-badge ok">approved</span>}
                      {p.review_requested_of_me && (
                        <span class="pr-badge accent">review requested</span>
                      )}
                    </div>
                    <div class="pr-name">{p.title}</div>
                  </div>
                  <div class="pr-actions">
                    <button class="icon-btn" title="Create task" onClick={() => onCreateTask(p)}>
                      <Plus size={14} />
                    </button>
                    <button class="icon-btn" title="Open PR" onClick={() => openExternal(p.url)}>
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
