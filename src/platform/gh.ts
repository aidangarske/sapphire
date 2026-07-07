import { PR_QUERY, searchQueries, parsePrGraph } from "../core/github/query.ts";
import type { Pr, Account } from "../core/github/types.ts";

export type GhStatus = "ok" | "not-authed" | "gh-missing";

const GH_CANDIDATES =
  process.platform === "win32"
    ? ["gh.exe", "gh"]
    : [
        "gh",
        "/opt/homebrew/bin/gh",
        "/usr/local/bin/gh",
        "/usr/bin/gh",
        "/home/linuxbrew/.linuxbrew/bin/gh",
      ];

export class GhError extends Error {
  constructor(public code: GhStatus | "gh-error") {
    super(code);
  }
}

interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

async function tryRun(bin: string, args: string[]): Promise<RunResult | "not-found"> {
  try {
    const proc = Bun.spawn([bin, ...args], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    return { ok: code === 0, stdout, stderr };
  } catch (e: any) {
    if (e?.code === "ENOENT" || /not found|no such file/i.test(String(e?.message))) {
      return "not-found";
    }
    throw e;
  }
}

// Try each candidate binary; ENOENT -> next; exhausted -> gh-missing. Auth
// failures in stderr map to not-authed so callers can prompt `gh auth login`.
async function runGh(args: string[]): Promise<string> {
  for (const bin of GH_CANDIDATES) {
    const res = await tryRun(bin, args);
    if (res === "not-found") continue;
    if (res.ok) return res.stdout;
    const err = res.stderr.toLowerCase();
    if (
      err.includes("not logged into") ||
      err.includes("gh auth login") ||
      err.includes("authentication")
    ) {
      throw new GhError("not-authed");
    }
    throw new GhError("gh-error");
  }
  throw new GhError("gh-missing");
}

export async function status(): Promise<GhStatus> {
  try {
    await runGh(["auth", "status"]);
    return "ok";
  } catch (e) {
    if (e instanceof GhError && e.code === "gh-missing") return "gh-missing";
    return "not-authed";
  }
}

export async function account(): Promise<Account | null> {
  try {
    const out = await runGh(["api", "user"]);
    const j = JSON.parse(out);
    return { login: j.login ?? "", name: j.name ?? "", avatar_url: j.avatar_url ?? "" };
  } catch (e) {
    if (e instanceof GhError && e.code === "not-authed") return null;
    throw e;
  }
}

export async function pullRequests(): Promise<Pr[]> {
  const login = (await runGh(["api", "user", "--jq", ".login"])).trim();
  if (!login) throw new GhError("not-authed");
  const { a, b, c } = searchQueries(login);
  const out = await runGh([
    "api",
    "graphql",
    "-f",
    `query=${PR_QUERY}`,
    "-f",
    `a=${a}`,
    "-f",
    `b=${b}`,
    "-f",
    `c=${c}`,
  ]);
  return parsePrGraph(JSON.parse(out));
}

export async function merged(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls) {
    try {
      const s = await runGh(["pr", "view", url, "--json", "state", "--jq", ".state"]);
      if (s.trim() === "MERGED") out.push(url);
    } catch {
      /* skip */
    }
  }
  return out;
}
