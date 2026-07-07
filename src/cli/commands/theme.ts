import { ok, fail } from "../output.ts";
import { loadConfig, updateConfig } from "../../platform/config.ts";
import { THEMES } from "../../tui/theme.ts";
import type { ParsedArgs } from "../args.ts";

export function themeCommand(args: ParsedArgs): void {
  const name = args.positionals[0];
  if (!name || name === "ls" || name === "list") {
    const current = loadConfig().theme;
    ok(
      { current, themes: THEMES.map((t) => ({ id: t.id, name: t.name })) },
      (r) => r.themes.map((t: any) => `${t.id === current ? "* " : "  "}${t.id}\t${t.name}`).join("\n"),
    );
    return;
  }
  if (!THEMES.some((t) => t.id === name)) fail("bad-value", `unknown theme '${name}'`);
  updateConfig({ theme: name });
  ok({ theme: name }, (r) => `theme: ${r.theme}`);
}
