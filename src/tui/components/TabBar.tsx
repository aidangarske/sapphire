import { Box, Text } from "ink";
import { useTheme } from "../useTheme.tsx";
import type { View } from "../App.tsx";

const TABS: { id: View; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "board", label: "Board" },
  { id: "prs", label: "PRs" },
];

export function TabBar({ view, workspace, themeName }: { view: View; workspace: string; themeName: string }) {
  const c = useTheme();
  const ws = workspace.replace(process.env.HOME ?? "~~~", "~");
  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color={c.accent} bold>
          ◈ Sapphire{"  "}
        </Text>
        {TABS.map((t, i) => {
          const active = t.id === view;
          return (
            <Text key={t.id}>
              <Text
                color={active ? c.bg0 : c.muted}
                backgroundColor={active ? c.accent : undefined}
                bold={active}
              >
                {" "}
                {i + 1} {t.label}{" "}
              </Text>
              <Text> </Text>
            </Text>
          );
        })}
      </Box>
      <Text color={c.muted}>
        {themeName} · {ws}
      </Text>
    </Box>
  );
}
