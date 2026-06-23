import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

const REPO_KEY = "sapphire.repoDir";

export const getRepoDir = () => localStorage.getItem(REPO_KEY) ?? "";
export const setRepoDir = (dir: string) => localStorage.setItem(REPO_KEY, dir.trim());
export const findRepoDir = () => invoke<string | null>("find_repo_dir");
export const relaunchApp = () => invoke("app_relaunch");

export async function runUpdate(
  repoDir: string,
  onLog: (line: string) => void,
  onDone: (ok: boolean) => void,
): Promise<void> {
  const us: UnlistenFn[] = [];
  us.push(await listen<string>("app-update-log", (e) => onLog(e.payload)));
  us.push(
    await listen<boolean>("app-update-done", (e) => {
      for (const u of us) u();
      onDone(e.payload);
    }),
  );
  try {
    await invoke("app_update", { repoDir });
  } catch (e) {
    for (const u of us) u();
    onLog(String(e));
    onDone(false);
  }
}
