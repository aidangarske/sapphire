import { dispatch } from "./cli/router.ts";

const argv = process.argv.slice(2);
const first = argv[0];

// No subcommand (or explicit `tui`) launches the interactive UI, like `claude`.
const wantsTui =
  argv.length === 0 || first === "tui" || first === "-i" || first === "--interactive";

if (wantsTui) {
  const { launchTui } = await import("./tui/main.tsx");
  await launchTui();
} else {
  try {
    await dispatch(argv);
  } catch (e) {
    process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
