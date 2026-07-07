import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { isWorkspace } from "./fs.ts";
import { loadConfig } from "./config.ts";

export type WsSource =
  | "flag"
  | "env"
  | "cwd"
  | "default-config"
  | "recent"
  | "none";

export interface Resolved {
  path: string | null;
  source: WsSource;
}

function findUpward(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (isWorkspace(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Precedence (high -> low): -w flag, SAPPHIRE_WORKSPACE, cwd-upward detection,
// defaultWorkspace config, most-recent workspace. See plan for rationale.
export function resolveWorkspace(flagWs?: string): Resolved {
  if (flagWs) return { path: resolve(flagWs), source: "flag" };

  const env = process.env.SAPPHIRE_WORKSPACE;
  if (env) return { path: resolve(env), source: "env" };

  const up = findUpward(process.cwd());
  if (up) return { path: up, source: "cwd" };

  const cfg = loadConfig();
  if (cfg.defaultWorkspace && existsSync(cfg.defaultWorkspace)) {
    return { path: cfg.defaultWorkspace, source: "default-config" };
  }
  const recent = cfg.recentWorkspaces.find((p) => existsSync(p));
  if (recent) return { path: recent, source: "recent" };

  return { path: null, source: "none" };
}
