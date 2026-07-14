import type { Pr } from "./types.ts";

export interface TodoAdd {
  title: string;
  url: string;
}

// True when a PR should land on your board: authored by you, assigned to you, or
// your review is requested.
export function isMine(p: Pr): boolean {
  return p.authored || p.assigned || p.review_requested_of_me;
}

// Board title for a PR, prefixed by how it concerns you and the repo, e.g.
// "REVIEW wolfTPM: Add API", "ASSIGNED wolfMQTT: …", "PR wolfssl: …". The PR
// URL rides along as the task's `pr:` meta line so it stays followable.
export function prTodoTitle(p: Pr): string {
  const repo = p.repo.split("/").pop() ?? p.repo;
  const kind =
    p.review_requested_of_me && !p.authored
      ? "REVIEW"
      : p.assigned && !p.authored
        ? "ASSIGNED"
        : "PR";
  return `${kind} ${repo}: ${p.title}`;
}

// PRs to add to the board's Todo column, excluding any already synced (seen) or
// already on the board. Pure so it can be unit-tested without gh or the filesystem.
export function plannedTodoAdds(
  prs: Pr[],
  seen: Set<string>,
  onBoard: Set<string>,
): TodoAdd[] {
  const out: TodoAdd[] = [];
  for (const p of prs) {
    if (!isMine(p)) continue;
    if (seen.has(p.url) || onBoard.has(p.url)) continue;
    out.push({ title: prTodoTitle(p), url: p.url });
  }
  return out;
}
