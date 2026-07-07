import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();

export function configHome(): string {
  if (process.platform === "win32") {
    return process.env.APPDATA ?? join(HOME, "AppData", "Roaming");
  }
  return process.env.XDG_CONFIG_HOME ?? join(HOME, ".config");
}

export function cacheHome(): string {
  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA ?? join(HOME, "AppData", "Local");
  }
  return process.env.XDG_CACHE_HOME ?? join(HOME, ".cache");
}

export const configDir = () => join(configHome(), "sapphire");
export const cacheDir = () => join(cacheHome(), "sapphire");
export const globalConfigPath = () => join(configDir(), "config.json");
export const prCachePath = () => join(cacheDir(), "prs.json");
