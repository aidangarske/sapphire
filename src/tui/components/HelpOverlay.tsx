import { Box, Text } from "ink";
import { useTheme } from "../useTheme.tsx";

const SECTIONS: [string, string[]][] = [
  ["Global", ["1/2/3  switch Notes / Board / PRs", "Tab    cycle views", "t      cycle theme", "?      this help", "q      quit"]],
  ["Notes", ["j / k      switch note", "↑↓ / wheel  scroll preview", "Space/Ctrl+D page down · b/Ctrl+U up", "g / G      top / bottom", "e or ⏎     edit in $EDITOR", "n new · r rename · d delete", "/          search (name + text)", "drag mouse select, Cmd+C copy"]],
  ["Board", ["←→ / h l   switch column", "↑↓ / j k   pick card", "< > or , .  move card to prev/next column", "d          mark done", "d d        delete (press d twice)", "Enter      task details · n add", "[ ]        switch board"]],
  ["PRs", ["grouped by repo", "↑↓ move · ←→/asdf category", "⏎          open in browser", "t          task from selected PR", "T          task for every PR in repo", "r          refresh"]],
];

export function HelpOverlay() {
  const c = useTheme();
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={c.accent} paddingX={2} paddingY={1}>
      <Text color={c.accent} bold>
        Sapphire — keybindings
      </Text>
      <Box marginTop={1} flexDirection="row" flexWrap="wrap">
        {SECTIONS.map(([title, rows]) => (
          <Box key={title} flexDirection="column" width={40} marginRight={2} marginBottom={1}>
            <Text color={c.accentHi} bold>
              {title}
            </Text>
            {rows.map((r, i) => (
              <Text key={i} color={c.text}>
                {r}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
      <Text color={c.muted}>press ? or Esc to close</Text>
    </Box>
  );
}
