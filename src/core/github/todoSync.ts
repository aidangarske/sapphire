import type { Pr } from "./types.ts";

export interface TodoAdd {
  title: string;
  url: string;
}

// Decide which PRs to add to the board's Todo column: ones you authored or
// where your review is requested, excluding any already synced (seen) or already
// on the board. Review-requested PRs get the "Review: … #review" label. Pure so
// it can be unit-tested without gh or the filesystem.
export function plannedTodoAdds(
  prs: Pr[],
  seen: Set<string>,
  onBoard: Set<string>,
): TodoAdd[] {
  const out: TodoAdd[] = [];
  for (const p of prs) {
    if (!(p.authored || p.review_requested_of_me)) continue;
    if (seen.has(p.url) || onBoard.has(p.url)) continue;
    const repo = p.repo.split("/").pop() ?? p.repo;
    const title =
      p.review_requested_of_me && !p.authored
        ? `Review: ${p.title} #${repo} #review`
        : `${p.title} #${repo}`;
    out.push({ title, url: p.url });
  }
  return out;
}
