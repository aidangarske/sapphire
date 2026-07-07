export function openUrl(url: string): void {
  if (!/^(https?|mailto):/i.test(url)) return;
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore", stdin: "ignore" });
  } catch {
    /* ignore */
  }
}
