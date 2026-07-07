import { parseArgs } from "./args.ts";
import { setJsonMode, fail } from "./output.ts";
import { noteCommand } from "./commands/note.ts";
import { boardCommand } from "./commands/board.ts";
import { prCommand } from "./commands/pr.ts";
import { logCommand } from "./commands/log.ts";
import { watchCommand } from "./commands/watch.ts";
import { workspaceCommand } from "./commands/workspace.ts";
import { configCommand } from "./commands/config.ts";
import { themeCommand } from "./commands/theme.ts";

export const HELP = `sapphire — a fast terminal notes + tasks + PR workspace

usage:
  sapphire                         launch the interactive TUI
  sapphire note new <title>        create a note (prints path)
  sapphire note ls|search|show|open|rename|rm
  sapphire board [show]            print the active board
  sapphire board add <col> <text> [--pr url]
  sapphire board move <task#> <col> | done <task#> | clear-done
  sapphire board ls|new|use
  sapphire pr [ls] | pr attention | pr sync | pr task <url> | pr status
  sapphire log today | log <YYYY-MM-DD> | log add <done|blocked|inprogress> <text>
  sapphire watch [--interval 60] [--once]
  sapphire workspace [which|init <path>|use <path>|list]
  sapphire config [list|get <k>|set <k> <v>] | theme [name]

global flags:
  -w, --workspace <path>   use this workspace
  --json                   machine-readable output (for CI)
  -h, --help               show this help
  -V, --version            show version`;

export async function dispatch(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (args.flags.json === true) setJsonMode(true);
  if (args.flags.help === true || args.flags.h === true) {
    process.stdout.write(HELP + "\n");
    return;
  }
  if (args.flags.version === true || args.flags.V === true) {
    process.stdout.write("sapphire 0.2.0\n");
    return;
  }

  const [cmd, sub = "", ...rest] = args.positionals;
  const subArgs = { positionals: sub ? [sub, ...rest] : rest, flags: args.flags };
  // hand each command its own (sub, {positionals: rest-after-sub})
  const withoutSub = { positionals: rest, flags: args.flags };

  switch (cmd) {
    case "note":
    case "n":
      noteCommand(sub, withoutSub);
      return;
    case "board":
    case "b":
      boardCommand(sub, withoutSub);
      return;
    case "pr":
      await prCommand(sub, withoutSub);
      return;
    case "log":
      logCommand(sub, withoutSub);
      return;
    case "watch":
      await watchCommand(subArgs);
      return;
    case "workspace":
    case "ws":
      workspaceCommand(sub, withoutSub);
      return;
    case "config":
      configCommand(sub, withoutSub);
      return;
    case "theme":
      themeCommand(subArgs);
      return;
    case "help":
      process.stdout.write(HELP + "\n");
      return;
    default:
      fail("bad-args", `unknown command '${cmd}'. Try: sapphire --help`);
  }
}
