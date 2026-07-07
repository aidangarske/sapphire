export interface Pr {
  repo: string;
  number: number;
  title: string;
  url: string;
  ci: "failing" | "pending" | "passing" | "no-checks" | "unknown";
  review: "approved" | "changes_requested" | "review_required" | "none";
  draft: boolean;
  conflict: boolean;
  authored: boolean;
  assigned: boolean;
  review_requested_of_me: boolean;
  author: string;
  assignees: string[];
  updated_at: string;
}

export interface Account {
  login: string;
  name: string;
  avatar_url: string;
}

export function needsAttention(p: Pr): boolean {
  return (
    p.review_requested_of_me || p.ci === "failing" || p.conflict || p.review === "changes_requested"
  );
}
