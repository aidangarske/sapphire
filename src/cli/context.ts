import { resolveWorkspace } from "../platform/env.ts";
import { setWorkspaceRoot } from "../platform/fs.ts";
import { flagStr } from "./args.ts";
import { fail } from "./output.ts";

// Resolve the workspace for a command, set it as the active fs root, and return
// its path. Fails with `no-workspace` (exit 2) when none can be found.
export function requireWorkspace(flags: Record<string, string | boolean>): string {
  const { path } = resolveWorkspace(flagStr(flags, "workspace", "w"));
  if (!path) {
    fail(
      "no-workspace",
      "no workspace found. Run `sapphire workspace init <path>` or pass -w <path>.",
      2,
    );
  }
  try {
    setWorkspaceRoot(path);
  } catch {
    fail("no-workspace", `workspace does not exist: ${path}`, 2);
  }
  return path;
}
