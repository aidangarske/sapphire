import { requireWorkspace } from "../context.ts";
import { ok, fail } from "../output.ts";
import * as prs from "../../services/prs.ts";
import * as gh from "../../platform/gh.ts";
import { needsAttention } from "../../core/github/types.ts";
import type { Pr } from "../../core/github/types.ts";
import type { ParsedArgs } from "../args.ts";

const CI_GLYPH: Record<Pr["ci"], string> = {
  failing: "✗",
  pending: "●",
  passing: "✓",
  "no-checks": "○",
  unknown: "?",
};

function renderPrs(list: Pr[]): string {
  if (list.length === 0) return "(no open PRs)";
  const byRepo = new Map<string, Pr[]>();
  for (const p of list) {
    const arr = byRepo.get(p.repo);
    if (arr) arr.push(p);
    else byRepo.set(p.repo, [p]);
  }
  const repos = [...byRepo.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const out: string[] = [];
  for (const [repo, prs] of repos) {
    out.push(`${repo} (${prs.length})`);
    for (const p of prs) {
      const tags = [
        p.authored ? "created" : "",
        p.review_requested_of_me ? "review" : "",
        p.assigned ? "assigned" : "",
        p.draft ? "draft" : "",
        p.conflict ? "conflict" : "",
        p.review === "changes_requested" ? "changes-requested" : "",
      ]
        .filter(Boolean)
        .join(",");
      out.push(`  ${CI_GLYPH[p.ci]} #${p.number}  ${p.title}${tags ? `  [${tags}]` : ""}`);
    }
  }
  return out.join("\n");
}

export async function prCommand(sub: string, args: ParsedArgs): Promise<void> {
  switch (sub) {
    case "status": {
      const s = await gh.status();
      ok({ status: s }, (r) => r.status);
      if (s !== "ok") process.exitCode = 1;
      return;
    }
    case "":
    case "ls":
    case "list": {
      try {
        const list = await prs.fetchPrs();
        ok(list, renderPrs);
      } catch (e) {
        const code = e instanceof gh.GhError ? e.code : "gh-error";
        fail(code, code === "gh-missing" ? "gh CLI not found — install GitHub CLI" : "run: gh auth login", 1);
      }
      return;
    }
    case "attention": {
      try {
        const list = (await prs.fetchPrs()).filter(needsAttention);
        ok(list, renderPrs);
      } catch (e) {
        const code = e instanceof gh.GhError ? e.code : "gh-error";
        fail(code, "gh error", 1);
      }
      return;
    }
    case "sync": {
      const ws = requireWorkspace(args.flags);
      const added = await prs.syncCreatedPrsToTodo(ws);
      ok({ added }, (r) => `synced ${r.added} PR(s) to Todo`);
      return;
    }
    case "task": {
      const ws = requireWorkspace(args.flags);
      const url = args.positionals[0];
      if (!url) fail("bad-args", "usage: sapphire pr task <url>");
      try {
        const list = await prs.fetchPrs();
        const pr = list.find((p) => p.url === url || p.url.endsWith(url));
        if (!pr) fail("not-found", `no PR matching '${url}'`);
        prs.createTaskFromPr(ws, pr!);
        ok({ created: pr!.title }, (r) => `created task: ${r.created}`);
      } catch (e) {
        if (e instanceof gh.GhError) fail(e.code, "gh error", 1);
        throw e;
      }
      return;
    }
    default:
      fail("bad-args", `unknown: pr ${sub}`);
  }
}
