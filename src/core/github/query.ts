import type { Pr } from "./types.ts";

export const PR_QUERY = `
query($a:String!,$b:String!,$c:String!){
  authored: search(query:$a, type:ISSUE, first:50){ nodes{ ...F } }
  assigned: search(query:$b, type:ISSUE, first:50){ nodes{ ...F } }
  review:   search(query:$c, type:ISSUE, first:50){ nodes{ ...F } }
}
fragment F on PullRequest {
  number title url isDraft updatedAt mergeable reviewDecision
  repository{ nameWithOwner }
  commits(last:1){ nodes{ commit{ statusCheckRollup{ state } } } }
}
`;

export function searchQueries(login: string): { a: string; b: string; c: string } {
  return {
    a: `is:pr is:open author:${login}`,
    b: `is:pr is:open assignee:${login}`,
    c: `is:pr is:open review-requested:${login}`,
  };
}

function ciFromState(state: string | undefined): Pr["ci"] {
  switch (state) {
    case "FAILURE":
    case "ERROR":
      return "failing";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    case "SUCCESS":
      return "passing";
    default:
      return "no-checks";
  }
}

function mergeNode(map: Map<string, Pr>, node: any, slot: 0 | 1 | 2) {
  const url: string | undefined = node?.url;
  if (!url) return;
  const rollupState: string | undefined =
    node?.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state;

  let entry = map.get(url);
  if (!entry) {
    const reviewDecision: string = node?.reviewDecision ?? "";
    entry = {
      repo: node?.repository?.nameWithOwner ?? "",
      number: Number(node?.number ?? 0),
      title: node?.title ?? "",
      url,
      ci: ciFromState(rollupState),
      review:
        reviewDecision === "APPROVED"
          ? "approved"
          : reviewDecision === "CHANGES_REQUESTED"
            ? "changes_requested"
            : "none",
      draft: Boolean(node?.isDraft),
      conflict: node?.mergeable === "CONFLICTING",
      authored: false,
      assigned: false,
      review_requested_of_me: false,
      updated_at: node?.updatedAt ?? "",
    };
    map.set(url, entry);
  }
  if (slot === 0) entry.authored = true;
  else if (slot === 1) entry.assigned = true;
  else entry.review_requested_of_me = true;
}

// Port of github.rs::pull_requests result assembly. Pure: takes the parsed
// GraphQL JSON, returns deduped PRs sorted newest-first.
export function parsePrGraph(json: any): Pr[] {
  const data = json?.data ?? {};
  const map = new Map<string, Pr>();
  const slots: Array<[string, 0 | 1 | 2]> = [
    ["authored", 0],
    ["assigned", 1],
    ["review", 2],
  ];
  for (const [alias, slot] of slots) {
    const nodes = data?.[alias]?.nodes;
    if (Array.isArray(nodes)) {
      for (const node of nodes) mergeNode(map, node, slot);
    }
  }
  const prs = [...map.values()];
  prs.sort((a, b) => (b.updated_at < a.updated_at ? -1 : b.updated_at > a.updated_at ? 1 : 0));
  return prs;
}
