import { requireWorkspace } from "../context.ts";
import { isJson } from "../output.ts";
import { flagStr } from "../args.ts";
import { syncCreatedPrsToTodo } from "../../services/prs.ts";
import { runNightlyClear } from "../../services/nightly.ts";
import * as gh from "../../platform/gh.ts";
import type { ParsedArgs } from "../args.ts";

function log(msg: string) {
  if (!isJson()) process.stderr.write(`[${new Date().toISOString()}] ${msg}\n`);
}

// Resident poll: PR->Todo sync + the once-a-day Done clear. `--once` runs a
// single tick (for cron). Otherwise loops every --interval seconds until SIGINT.
export async function watchCommand(args: ParsedArgs): Promise<void> {
  const ws = requireWorkspace(args.flags);
  const once = args.flags.once === true;
  const interval = Math.max(15, Number(flagStr(args.flags, "interval") ?? 60)) * 1000;

  const status = await gh.status();
  if (status !== "ok") log(`gh not ready (${status}); PR sync disabled until authenticated`);

  const tick = async () => {
    try {
      const added = await syncCreatedPrsToTodo(ws);
      const { cleared, removed } = runNightlyClear(ws);
      log(`tick: ${added} synced${cleared ? `, cleared ${removed} done` : ""}`);
    } catch (e) {
      log(`tick error: ${String(e)}`);
    }
  };

  await tick();
  if (once) return;

  log(`watching every ${interval / 1000}s (Ctrl+C to stop)`);
  const timer = setInterval(tick, interval);
  await new Promise<void>((resolve) => {
    const stop = () => {
      clearInterval(timer);
      log("stopped");
      resolve();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}
