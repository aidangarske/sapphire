import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

export interface Pr {
  repo: string;
  number: number;
  title: string;
  url: string;
  ci: "failing" | "pending" | "passing" | "no-checks" | "unknown";
  review: "approved" | "changes_requested" | "none";
  draft: boolean;
  conflict: boolean;
  authored: boolean;
  assigned: boolean;
  review_requested_of_me: boolean;
  updated_at: string;
}

export interface Account {
  login: string;
  name: string;
  avatar_url: string;
}

// "ok" | "not-authed" | "gh-missing"
export const githubStatus = () => invoke<string>("github_status");
export const githubAccount = () => invoke<Account | null>("github_account");
export const fetchPrs = () => invoke<Pr[]>("github_prs");

export function needsAttention(p: Pr): boolean {
  return (
    p.review_requested_of_me || p.ci === "failing" || p.conflict || p.review === "changes_requested"
  );
}

export function openExternal(url: string) {
  if (!/^(https?|mailto):/i.test(url)) return; // only safe schemes
  openUrl(url).catch(() => window.open(url, "_blank"));
}
