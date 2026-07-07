import { Box, Text } from "ink";
import { useTheme } from "../useTheme.tsx";

export function StatusBar({ hints, toast }: { hints: string; toast?: string }) {
  const c = useTheme();
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text color={c.muted}>{hints}</Text>
      {toast ? <Text color={c.ok}>{toast}</Text> : <Text> </Text>}
    </Box>
  );
}
