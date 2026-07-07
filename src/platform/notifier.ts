export interface Notification {
  title: string;
  body: string;
  url?: string;
}

function spawnDetached(cmd: string[]): void {
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore", stdin: "ignore" });
  } catch {
    /* notifier unavailable; ignore */
  }
}

// Cross-platform desktop notification via the OS's own tool, shelled out so the
// compiled binary stays self-contained. URL-click-to-open is best-effort.
export function notify(n: Notification): void {
  const title = n.title.replace(/"/g, "'");
  const body = n.body.replace(/"/g, "'");
  if (process.platform === "darwin") {
    spawnDetached([
      "osascript",
      "-e",
      `display notification "${body}" with title "${title}"`,
    ]);
  } else if (process.platform === "win32") {
    const ps =
      `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] > $null; ` +
      `$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); ` +
      `$t.GetElementsByTagName('text')[0].AppendChild($t.CreateTextNode("${title}")) > $null; ` +
      `$t.GetElementsByTagName('text')[1].AppendChild($t.CreateTextNode("${body}")) > $null; ` +
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Sapphire").Show([Windows.UI.Notifications.ToastNotification]::new($t))`;
    spawnDetached(["powershell", "-NoProfile", "-Command", ps]);
  } else {
    spawnDetached(["notify-send", "-a", "Sapphire", title, body]);
  }
}
