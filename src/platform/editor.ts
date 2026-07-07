import { spawnSync } from "node:child_process";

export function editorCommand(): string {
  return (
    process.env.SAPPHIRE_EDITOR ||
    process.env.VISUAL ||
    process.env.EDITOR ||
    (process.platform === "win32" ? "notepad" : "vim")
  );
}

// Open `path` in the user's editor, inheriting the terminal so vim/nano work.
// Returns true on a clean exit. Callers in the TUI must suspend Ink first.
export function openInEditor(path: string): boolean {
  const editor = editorCommand();
  const res = spawnSync(editor, [path], { stdio: "inherit" });
  return res.status === 0 || res.status === null;
}
