import { ok, fail } from "../output.ts";
import { loadConfig, saveConfig, type GlobalConfig } from "../../platform/config.ts";
import { THEME_IDS } from "../../tui/theme.ts";
import type { ParsedArgs } from "../args.ts";

function get(cfg: GlobalConfig, key: string): unknown {
  return (cfg as any)[key];
}

function set(cfg: GlobalConfig, key: string, val: string): void {
  const bool = val === "true" ? true : val === "false" ? false : undefined;
  if (key === "theme") {
    if (!THEME_IDS.includes(val)) throw new Error(`unknown theme '${val}'`);
    cfg.theme = val;
    return;
  }
  if (key === "mouse") {
    cfg.mouse = bool ?? false;
    return;
  }
  throw new Error(`unknown or read-only config key '${key}'`);
}

export function configCommand(sub: string, args: ParsedArgs): void {
  const cfg = loadConfig();
  const rest = args.positionals;

  switch (sub) {
    case "":
    case "list": {
      ok(cfg, (r) =>
        Object.entries({ theme: r.theme, mouse: r.mouse })
          .map(([k, v]) => `${k} = ${v}`)
          .join("\n"),
      );
      return;
    }
    case "get": {
      const key = rest[0];
      if (!key) fail("bad-args", "usage: sapphire config get <key>");
      ok({ key, value: get(cfg, key) }, (r) => String(r.value));
      return;
    }
    case "set": {
      const key = rest[0];
      const val = rest.slice(1).join(" ");
      if (!key || val === "") fail("bad-args", "usage: sapphire config set <key> <value>");
      try {
        set(cfg, key, val);
      } catch (e) {
        fail("bad-value", String((e as Error).message));
      }
      saveConfig(cfg);
      ok({ key, value: get(cfg, key) }, (r) => `${r.key} = ${r.value}`);
      return;
    }
    default:
      fail("bad-args", `unknown: config ${sub}`);
  }
}
