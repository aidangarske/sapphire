import { requireWorkspace } from "../context.ts";
import { ok, fail } from "../output.ts";
import { logActivity, flushDailyToNote, loggedDates } from "../../services/daily.ts";
import { dateStr } from "../../core/journal.ts";
import type { ActAction } from "../../core/types.ts";
import type { ParsedArgs } from "../args.ts";

const ACTIONS = new Set<ActAction>(["done", "blocked", "inprogress"]);

export function logCommand(sub: string, args: ParsedArgs): void {
  const ws = requireWorkspace(args.flags);
  const rest = args.positionals;

  switch (sub) {
    case "":
    case "today": {
      const md = flushDailyToNote(ws, dateStr(Date.now()));
      ok({ appended: md }, (r) => (r.appended ? r.appended.trim() : "(nothing to log today)"));
      return;
    }
    case "dates": {
      const dates = loggedDates(ws);
      ok(dates, (r) => r.join("\n") || "(no activity)");
      return;
    }
    case "add": {
      const action = rest[0] as ActAction;
      const title = rest.slice(1).join(" ");
      if (!ACTIONS.has(action) || !title) {
        fail("bad-args", "usage: sapphire log add <done|blocked|inprogress> <title>");
      }
      logActivity(ws, action, title);
      ok({ logged: title, action }, (r) => `logged (${r.action}): ${r.logged}`);
      return;
    }
    default: {
      // treat `log <YYYY-MM-DD>` as flush-for-date
      if (/^\d{4}-\d{2}-\d{2}$/.test(sub)) {
        const md = flushDailyToNote(ws, sub);
        ok({ appended: md }, (r) => (r.appended ? r.appended.trim() : `(nothing to log for ${sub})`));
        return;
      }
      fail("bad-args", `unknown: log ${sub}`);
    }
  }
}
