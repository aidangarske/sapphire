import { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { ThemeProvider } from "./useTheme.tsx";
import { getTheme, THEMES } from "./theme.ts";
import { TabBar } from "./components/TabBar.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { HelpOverlay } from "./components/HelpOverlay.tsx";
import { CommandPalette, type Command } from "./components/CommandPalette.tsx";
import { NotesScreen } from "./screens/NotesScreen.tsx";
import { BoardScreen } from "./screens/BoardScreen.tsx";
import { PrScreen } from "./screens/PrScreen.tsx";
import { loadConfig, updateConfig } from "../platform/config.ts";
import { runWatcherTick, syncCreatedPrsToTodo } from "../services/prs.ts";
import { runNightlyClear } from "../services/nightly.ts";
import { flushDailyToNote } from "../services/daily.ts";
import { inputLocked } from "./inputLock.ts";

export type View = "notes" | "board" | "prs";

export function App({
  ws,
  suspendAndEdit,
}: {
  ws: string;
  suspendAndEdit: (path: string) => Promise<void>;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [view, setView] = useState<View>("notes");
  const [themeId, setThemeId] = useState(() => loadConfig().theme);
  const [help, setHelp] = useState(false);
  const [palette, setPalette] = useState(false);
  const [hints, setHints] = useState("");
  const [toastMsg, setToastMsg] = useState<string>();
  const [rows, setRows] = useState(stdout.rows || 30);
  const [cols, setCols] = useState(stdout.columns || 100);

  useEffect(() => {
    const onResize = () => {
      setRows(stdout.rows || 30);
      setCols(stdout.columns || 100);
    };
    if (typeof (stdout as any).on !== "function") return;
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  const toast = (t: string) => {
    setToastMsg(t);
    setTimeout(() => setToastMsg(undefined), 2000);
  };

  // Background poll while the TUI is open: notifications, PR->Todo sync, nightly clear.
  useEffect(() => {
    let stop = false;
    const tick = () => {
      if (stop) return;
      void runWatcherTick().catch(() => {});
      void syncCreatedPrsToTodo(ws).catch(() => {});
      runNightlyClear(ws);
    };
    const first = setTimeout(tick, 3000);
    const id = setInterval(tick, 60000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ws]);

  const cycleTheme = () => {
    const i = THEMES.findIndex((x) => x.id === themeId);
    const next = THEMES[(i + 1) % THEMES.length].id;
    setThemeId(next);
    updateConfig({ theme: next });
    toast(`theme: ${next}`);
  };

  const commands: Command[] = useMemo(
    () => [
      { id: "notes", label: "Go to Notes", run: () => setView("notes") },
      { id: "board", label: "Go to Board", run: () => setView("board") },
      { id: "prs", label: "Go to Pull Requests", run: () => setView("prs") },
      { id: "theme", label: "Cycle theme", run: cycleTheme },
      {
        id: "log",
        label: "Log today → daily note",
        run: () => toast(flushDailyToNote(ws) ? "logged today" : "nothing to log"),
      },
      { id: "help", label: "Show keybindings", run: () => setHelp(true) },
      { id: "quit", label: "Quit Sapphire", run: () => exit() },
      ...THEMES.map((t) => ({
        id: `theme-${t.id}`,
        label: `Theme: ${t.name}`,
        run: () => {
          setThemeId(t.id);
          updateConfig({ theme: t.id });
          toast(`theme: ${t.id}`);
        },
      })),
    ],
    [ws, themeId],
  );

  const overlay = help || palette;
  useInput((input, key) => {
    if (inputLocked()) return; // a text box / confirm / palette owns input
    if (help) {
      if (input === "?" || key.escape) setHelp(false);
      return;
    }
    if (input === ":") setPalette(true);
    else if (input === "?") setHelp(true);
    else if (input === "1") setView("notes");
    else if (input === "2") setView("board");
    else if (input === "3") setView("prs");
    else if (key.tab) setView((v) => (v === "notes" ? "board" : v === "board" ? "prs" : "notes"));
    else if (input === "t") cycleTheme();
    else if (input === "q" || (key.ctrl && input === "c")) exit();
  });

  const contentHeight = Math.max(6, rows - 3);
  const theme = getTheme(themeId);

  return (
    <ThemeProvider id={themeId}>
      <Box flexDirection="column" width={cols} height={rows}>
        <TabBar view={view} workspace={ws} themeName={theme.name} />
        <Box flexGrow={1} paddingX={1}>
          {palette ? (
            <CommandPalette commands={commands} onClose={() => setPalette(false)} />
          ) : help ? (
            <HelpOverlay />
          ) : view === "notes" ? (
            <NotesScreen ws={ws} active={!overlay} height={contentHeight} suspendAndEdit={suspendAndEdit} setHints={setHints} toast={toast} />
          ) : view === "board" ? (
            <BoardScreen ws={ws} active={!overlay} height={contentHeight} width={cols - 2} setHints={setHints} toast={toast} />
          ) : (
            <PrScreen ws={ws} active={!overlay} height={contentHeight} setHints={setHints} toast={toast} />
          )}
        </Box>
        <StatusBar
          hints={palette ? "type to filter · ↑↓ select · ⏎ run · Esc close" : help ? "press ? or Esc to close help" : hints}
          toast={toastMsg}
        />
      </Box>
    </ThemeProvider>
  );
}

export function FirstRun({ onError }: { onError: string }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text>{onError}</Text>
    </Box>
  );
}
