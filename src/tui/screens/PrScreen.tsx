import { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import * as prsvc from "../../services/prs.ts";
import { needsAttention } from "../../core/github/types.ts";
import { openUrl } from "../../platform/opener.ts";
import type { Pr } from "../../core/github/types.ts";
import type { ThemeTokens } from "../theme.ts";

type Cat = "all" | "created" | "attention" | "review" | "assigned";
const CATS: { id: Cat; label: string; key: string }[] = [
  { id: "all", label: "All", key: "" },
  { id: "created", label: "Created", key: "a" },
  { id: "attention", label: "Needs attention", key: "s" },
  { id: "review", label: "Review requested", key: "d" },
  { id: "assigned", label: "Assigned", key: "f" },
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

function reviewBadge(
  review: Pr["review"],
  c: ThemeTokens,
): { label: string; color: string } | null {
  switch (review) {
    case "approved":
      return { label: "✓ approved", color: c.ok };
    case "changes_requested":
      return { label: "✎ changes", color: c.bad };
    case "review_required":
      return { label: "• needs review", color: c.warn };
    default:
      return null;
  }
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
      setHints("↑↓ move · ←→/asdf category · ⏎ open · t task · T all-in-repo · r refresh · ? help");
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
      } else if ("asdf".includes(input)) {
        const hit = CATS.find((x) => x.key === input);
        if (hit) {
          setCat(hit.id);
          setSel(0);
        }
      } else if (key.return && current) {
        openUrl(current.url);
        toast("opened in browser");
      } else if (input === "t" && current) {
        prsvc.createTaskFromPr(ws, current);
        toast("task created");
      } else if (input === "T" && current) {
        const repoPrs = filtered.filter((p) => p.repo === current.repo);
        for (const p of repoPrs) prsvc.createTaskFromPr(ws, p);
        toast(`filed ${repoPrs.length} from ${current.repo.split("/").pop()}`);
      } else if (input === "r") refresh();
    },
    { isActive: active },
  );

  const rows = Math.max(3, height - 4);
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
            const rb = reviewBadge(p.review, c);
            const assignees = (p.assignees ?? [])
              .map((a) => (me && a === me ? `★${a}` : a))
              .join(",");
            return (
              <Text key={p.url} wrap="truncate" backgroundColor={isSel ? c.bg3 : undefined}>
                {"  "}
                <Text color={color}>{g} </Text>
                <Text color={c.muted}>#{p.number} </Text>
                {p.authored ? <Text color={c.accentHi} bold>◆ </Text> : null}
                <Text color={isSel ? c.accentHi : undefined}>{p.title}</Text>
                {p.draft ? <Text color={c.muted}> (draft)</Text> : null}
                {p.conflict ? <Text color={c.bad}> ⚠ conflict</Text> : null}
                {rb ? <Text color={rb.color}> {rb.label}</Text> : null}
                {p.authored ? null : <Text color={c.muted}> by @{p.author}</Text>}
                {assignees ? (
                  <Text color={p.assigned ? c.accentHi : c.muted}> → {assignees}</Text>
                ) : (
                  <Text color={c.muted}> → unassigned</Text>
                )}
              </Text>
            );
          })
        )}
      </Box>
    </Box>
  );
}
