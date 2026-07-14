import { globalConfigPath } from "./paths.ts";
import { readTextIfExists, writeText } from "./fs.ts";

export interface GlobalConfig {
  theme: string;
  mouse: boolean;
  defaultWorkspace?: string;
  recentWorkspaces: string[];
}

const DEFAULTS: GlobalConfig = {
  theme: "sapphire",
  // Off by default so native terminal text selection / copy-paste keeps working.
  // Turn on (config set mouse true) to enable wheel-scroll of the note preview.
  mouse: false,
  recentWorkspaces: [],
};

let cached: GlobalConfig | null = null;

export function loadConfig(): GlobalConfig {
  if (cached) return cached;
  const raw = readTextIfExists(globalConfigPath());
  let parsed: Partial<GlobalConfig> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }
  cached = {
    ...DEFAULTS,
    ...parsed,
    recentWorkspaces: parsed.recentWorkspaces ?? [],
  };
  return cached;
}

export function saveConfig(cfg: GlobalConfig): void {
  cached = cfg;
  writeText(globalConfigPath(), JSON.stringify(cfg, null, 2) + "\n");
}

export function updateConfig(patch: Partial<GlobalConfig>): GlobalConfig {
  const next = { ...loadConfig(), ...patch };
  saveConfig(next);
  return next;
}

export function rememberWorkspace(path: string): void {
  const cfg = loadConfig();
  const recent = [path, ...cfg.recentWorkspaces.filter((p) => p !== path)].slice(0, 10);
  saveConfig({ ...cfg, defaultWorkspace: path, recentWorkspaces: recent });
}
