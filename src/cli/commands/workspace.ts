import { resolve } from "node:path";
import { ok, fail } from "../output.ts";
import { flagStr } from "../args.ts";
import { ensureWorkspace } from "../../platform/fs.ts";
import { resolveWorkspace } from "../../platform/env.ts";
import { rememberWorkspace, loadConfig } from "../../platform/config.ts";
import type { ParsedArgs } from "../args.ts";

export function workspaceCommand(sub: string, args: ParsedArgs): void {
  const rest = args.positionals;

  switch (sub) {
    case "init": {
      const dir = resolve(rest[0] ?? flagStr(args.flags, "workspace", "w") ?? process.cwd());
      const canon = ensureWorkspace(dir);
      rememberWorkspace(canon);
      ok({ workspace: canon }, (r) => `initialized workspace: ${r.workspace}`);
      return;
    }
    case "use": {
      const dir = resolve(rest[0] ?? "");
      if (!rest[0]) fail("bad-args", "usage: sapphire workspace use <path>");
      rememberWorkspace(dir);
      ok({ defaultWorkspace: dir }, (r) => `default workspace: ${r.defaultWorkspace}`);
      return;
    }
    case "list": {
      const cfg = loadConfig();
      ok(
        { default: cfg.defaultWorkspace, recent: cfg.recentWorkspaces },
        (r) =>
          [r.default ? `* ${r.default}` : "(no default)", ...r.recent.filter((p: string) => p !== r.default).map((p: string) => `  ${p}`)].join("\n"),
      );
      return;
    }
    case "":
    case "which": {
      const { path, source } = resolveWorkspace(flagStr(args.flags, "workspace", "w"));
      if (!path) {
        ok({ path: null, source }, () => "no workspace resolved");
        return;
      }
      ok({ path, source }, (r) => `${r.path}  (via ${r.source})`);
      return;
    }
    default:
      fail("bad-args", `unknown: workspace ${sub}`);
  }
}
