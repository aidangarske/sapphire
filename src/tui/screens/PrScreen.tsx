import { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import * as prsvc from "../../services/prs.ts";
import { needsAttention, readyForReview } from "../../core/github/types.ts";
import { openUrl } from "../../platform/opener.ts";
import type { Pr } from "../../core/github/types.ts";
import type { ThemeTokens } from "../theme.ts";

type Cat = "all" | "created" | "attention" | "review" | "assigned" | "ready";
const CATS: { id: Cat; label: string; key: string }[] = [
  { id: "all", label: "All", key: "" },
  { id: "created", label: "Created", key: "a" },
  { id: "attention", label: "Needs attention", key: "s" },
  { id: "review", label: "Review requested", key: "d" },
  { id: "assigned", label: "Assigned", key: "f" },
  { id: "ready", label: "Ready for review", key: "g" },
];

function ciGlyph(ci: Pr["ci"], c: ThemeTokens): { g: string; color: string } {
  switch (ci) {
    case "failing":
      return { g: "✗", color: c.bad };
    case "pending":
      return { g: "●", color: c.warn };
    case "passing":
      return { g: "✓", color: c.ok };
    default:
      return { g: "○", color: c.muted };
  }
}

function reviewGlyph(review: Pr["review"], c: ThemeTokens): { g: string; color: string } | null {
  switch (review) {
    case "approved":
      return { g: "✓", color: c.ok };
    case "changes_requested":
      return { g: "✎", color: c.bad };
    default:
      return null;
  }
}

function reviewWord(review: Pr["review"]): { label: string; tone: "ok" | "bad" | "warn" | "muted" } {
  switch (review) {
    case "approved":
      return { label: "approved", tone: "ok" };
    case "changes_requested":
      return { label: "changes requested", tone: "bad" };
    case "review_required":
      return { label: "needs review", tone: "warn" };
    default:
      return { label: "no review", tone: "muted" };
  }
}

const CI_WORD: Record<Pr["ci"], string> = {
  failing: "failing",
  pending: "pending",
  passing: "passing",
  "no-checks": "no checks",
  unknown: "unknown",
};

function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function inCat(p: Pr, cat: Cat): boolean {
  switch (cat) {
    case "created":
      return p.authored;
    case "attention":
      return needsAttention(p);
    case "review":
      return p.review_requested_of_me;
    case "assigned":
      return p.assigned;
    case "ready":
      return readyForReview(p);
    default:
      return true;
  }
}

export function PrScreen({
  ws,
  active,
  height,
  setHints,
  toast,
}: {
  ws: string;
  active: boolean;
  height: number;
  setHints: (h: string) => void;
  toast: (t: string) => void;
}) {
  const c = useTheme();
  const me = prsvc.cachedLogin();
  const [prs, setPrs] = useState<Pr[]>(() => prsvc.cachedPrs());
  const [cat, setCat] = useState<Cat>("all");
  const [sel, setSel] = useState(0);
  const [status, setStatus] = useState<string>(prsvc.cachedPrs().length ? "" : "loading…");

  const refresh = () => {
    setStatus("refreshing…");
    prsvc
      .fetchPrs()
      .then((list) => {
        setPrs(list);
        setStatus("");
      })
      .catch((e) => setStatus(e?.code === "gh-missing" ? "gh not installed" : "gh auth needed — run: gh auth login"));
  };
  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => prs.filter((p) => inCat(p, cat)), [prs, cat]);

  // Group by repo (repos alphabetical, PRs newest-first within each).
  const groups = useMemo(() => {
    const map = new Map<string, Pr[]>();
    for (const p of filtered) {
      const arr = map.get(p.repo);
      if (arr) arr.push(p);
      else map.set(p.repo, [p]);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([repo, list]) => ({ repo, list }));
  }, [filtered]);

  const ordered = useMemo(() => groups.flatMap((g) => g.list), [groups]);
  const selIdx = Math.min(sel, Math.max(0, ordered.length - 1));
  const current = ordered[selIdx];

  // Flatten to render rows: a header per repo, then its PRs.
  type Row = { kind: "header"; repo: string; count: number } | { kind: "pr"; pr: Pr; idx: number };
  const items = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let idx = 0;
    for (const g of groups) {
      out.push({ kind: "header", repo: g.repo, count: g.list.length });
      for (const pr of g.list) out.push({ kind: "pr", pr, idx: idx++ });
    }
    return out;
  }, [groups]);

  useEffect(() => {
    if (active)
      setHints("↑↓ move · ←→/asdfg category · ⏎ open · n task · N all-in-repo · r refresh · ? help");
  }, [active]);

  useInput(
    (input, key) => {
      const n = ordered.length;
      if (key.upArrow || input === "k") setSel((s) => (n ? (s - 1 + n) % n : 0));
      else if (key.downArrow || input === "j") setSel((s) => (n ? (s + 1) % n : 0));
      else if (key.leftArrow) {
        const i = CATS.findIndex((x) => x.id === cat);
        setCat(CATS[(i - 1 + CATS.length) % CATS.length].id);
        setSel(0);
      } else if (key.rightArrow) {
        const i = CATS.findIndex((x) => x.id === cat);
        setCat(CATS[(i + 1) % CATS.length].id);
        setSel(0);
      } else if (input && "asdfg".includes(input)) {
        const hit = CATS.find((x) => x.key === input);
        if (hit) {
          setCat(hit.id);
          setSel(0);
        }
      } else if (key.return && current) {
        openUrl(current.url);
        toast("opened in browser");
      } else if (input === "n" && current) {
        toast(prsvc.createTaskFromPr(ws, current) ? "task created" : "already filed");
      } else if (input === "N" && current) {
        const repoPrs = filtered.filter((p) => p.repo === current.repo);
        const filed = repoPrs.reduce((n, p) => n + (prsvc.createTaskFromPr(ws, p) ? 1 : 0), 0);
        toast(`filed ${filed} from ${current.repo.split("/").pop()}`);
      } else if (input === "r") refresh();
    },
    { isActive: active },
  );

  const rows = Math.max(3, height - 5);
  const focusItem = items.findIndex((it) => it.kind === "pr" && it.idx === selIdx);
  const start =
    items.length > rows && focusItem >= 0
      ? Math.max(0, Math.min(focusItem - Math.floor(rows / 2), items.length - rows))
      : 0;
  const shown = items.slice(start, start + rows);

  return (
    <Box flexDirection="column" height={height}>
      <Box>
        {CATS.map((x) => {
          const on = x.id === cat;
          const count = prs.filter((p) => inCat(p, x.id)).length;
          return (
            <Text key={x.id} color={on ? c.bg0 : c.muted} backgroundColor={on ? c.accent : undefined} bold={on}>
              {" "}
              {x.label} {count}{" "}
              <Text> </Text>
            </Text>
          );
        })}
        {status ? <Text color={c.warn}>  {status}</Text> : null}
      </Box>
      <Box flexDirection="column" borderStyle="round" borderColor={c.border} paddingX={1} flexGrow={1}>
        {ordered.length === 0 ? (
          <Text color={c.muted}>{status || "no PRs in this category"}</Text>
        ) : (
          shown.map((it) => {
            if (it.kind === "header") {
              return (
                <Text key={`h:${it.repo}`} color={c.accent} bold wrap="truncate">
                  {it.repo} ({it.count})
                </Text>
              );
            }
            const p = it.pr;
            const isSel = it.idx === selIdx;
            const { g, color } = ciGlyph(p.ci, c);
            const rg = reviewGlyph(p.review, c);
            return (
              <Text key={p.url} wrap="truncate" backgroundColor={isSel ? c.bg3 : undefined}>
                {"  "}
                <Text color={color}>{g} </Text>
                <Text color={rg ? rg.color : c.muted}>{rg ? rg.g : " "} </Text>
                <Text color={p.authored ? c.accent : c.muted} bold={p.authored}>
                  {`#${p.number}`.padEnd(7)}
                </Text>
                <Text color={isSel ? c.accentHi : c.text}>{p.title}</Text>
                {p.draft ? <Text color={c.muted}> (draft)</Text> : null}
                {p.conflict ? <Text color={c.bad}> ⚠</Text> : null}
              </Text>
            );
          })
        )}
      </Box>
      {current ? <DetailLine pr={current} me={me} c={c} /> : null}
    </Box>
  );
}

function DetailLine({ pr, me, c }: { pr: Pr; me: string; c: ThemeTokens }) {
  const tone = { ok: c.ok, bad: c.bad, warn: c.warn, muted: c.muted };
  const rw = reviewWord(pr.review);
  const who = (pr.assignees ?? []);
  const dot = <Text color={c.border}> · </Text>;
  return (
    <Box>
      <Text wrap="truncate">
        <Text color={c.muted}>#{pr.number} </Text>
        {pr.authored ? (
          <Text color={c.accent} bold>mine</Text>
        ) : (
          <Text color={c.muted}>by @{pr.author}</Text>
        )}
        {dot}
        <Text color={tone[rw.tone]}>{rw.label}</Text>
        {dot}
        <Text color={c.muted}>CI {CI_WORD[pr.ci]}</Text>
        {pr.conflict ? (
          <>
            {dot}
            <Text color={c.bad}>conflict</Text>
          </>
        ) : null}
        {dot}
        {who.length ? (
          <Text color={pr.assigned ? c.accentHi : c.muted}>
            {who.map((a) => (me && a === me ? `★${a}` : a)).join(", ")}
          </Text>
        ) : (
          <Text color={c.muted}>unassigned</Text>
        )}
        {dot}
        <Text color={c.muted}>{relTime(pr.updated_at)}</Text>
      </Text>
    </Box>
  );
}
