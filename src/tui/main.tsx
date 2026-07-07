import { useEffect } from "react";
import { render, useApp } from "ink";
import { homedir } from "node:os";
import { join } from "node:path";
import { App } from "./App.tsx";
import { resolveWorkspace } from "../platform/env.ts";
import { setWorkspaceRoot, ensureWorkspace } from "../platform/fs.ts";
import { rememberWorkspace, loadConfig } from "../platform/config.ts";
import { openInEditor } from "../platform/editor.ts";

// Alt screen + hidden cursor + alternate-scroll mode (?1007). Alternate scroll
// makes the wheel send arrow keys to the app WITHOUT capturing the mouse, so the
// terminal's native text selection / copy-paste still works. Full mouse tracking
// (?1000/?1006) is opt-in only, since it does disable selection.
const mouseOn = () => loadConfig().mouse === true;
const enterAlt = () =>
  process.stdout.write(
    "\x1b[?1049h\x1b[?25l\x1b[?1007h" + (mouseOn() ? "\x1b[?1000h\x1b[?1006h" : ""),
  );
const leaveAlt = () =>
  process.stdout.write(
    (mouseOn() ? "\x1b[?1000l\x1b[?1006l" : "") + "\x1b[?1007l\x1b[?25h\x1b[?1049l",
  );

function resolveOrCreateWorkspace(): string {
  const { path } = resolveWorkspace();
  if (path) {
    setWorkspaceRoot(path);
    return path;
  }
  // Documents/Sapphire, not ~/Sapphire — the latter collides with a repo named
  // "sapphire" on case-insensitive macOS filesystems.
  const fallback = ensureWorkspace(join(homedir(), "Documents", "Sapphire"));
  rememberWorkspace(fallback);
  return fallback;
}

type Suspend = (cb: () => void | Promise<void>) => Promise<void>;

// Hand Ink's suspendTerminal (which pauses input and forces a full redraw on
// resume) up to launchTui so the editor swap doesn't strand a blank screen.
function Root({
  ws,
  suspendAndEdit,
  onReady,
}: {
  ws: string;
  suspendAndEdit: (path: string) => Promise<void>;
  onReady: (suspend: Suspend) => void;
}) {
  const { suspendTerminal } = useApp();
  useEffect(() => {
    onReady(suspendTerminal);
  }, [onReady, suspendTerminal]);
  return <App ws={ws} suspendAndEdit={suspendAndEdit} />;
}

export async function launchTui(): Promise<void> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    process.stderr.write(
      "Sapphire's interactive UI needs a terminal. Try a subcommand, e.g. `sapphire board`.\n",
    );
    process.exitCode = 1;
    return;
  }

  const ws = resolveOrCreateWorkspace();
  let suspend: Suspend | null = null;

  const suspendAndEdit = async (file: string): Promise<void> => {
    const run = suspend;
    if (!run) return;
    await run(() => {
      leaveAlt();
      openInEditor(file);
      enterAlt();
    });
  };

  enterAlt();
  const instance = render(
    <Root ws={ws} suspendAndEdit={suspendAndEdit} onReady={(fn) => (suspend = fn)} />,
    // kittyKeyboard auto: terminals that support it (Ghostty, kitty) report the
    // Cmd (super) modifier and Home/End, which the note editor maps to shortcuts.
    { exitOnCtrlC: false, patchConsole: false, kittyKeyboard: { mode: "auto" } },
  );

  const cleanup = () => leaveAlt();
  process.on("exit", cleanup);
  try {
    await instance.waitUntilExit();
  } finally {
    process.off("exit", cleanup);
    leaveAlt();
  }
}
