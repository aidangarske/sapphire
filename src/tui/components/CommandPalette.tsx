import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import { deletionKind, applyDeletion, isPrintable } from "../textedit.ts";
import { useInputLock } from "../inputLock.ts";

export interface Command {
  id: string;
  label: string;
  run: () => void;
}

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const c = useTheme();
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  useInputLock();

  const q = query.toLowerCase();
  const filtered = commands.filter((cmd) => cmd.label.toLowerCase().includes(q));
  const clamped = Math.min(sel, Math.max(0, filtered.length - 1));

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return) {
      const cmd = filtered[clamped];
      onClose();
      cmd?.run();
      return;
    }
    if (key.upArrow) {
      setSel((s) => Math.max(0, s - 1));
      return;
    }
    if (key.downArrow) {
      setSel((s) => Math.min(filtered.length - 1, s + 1));
      return;
    }
    const del = deletionKind(input, key);
    if (del) {
      setQuery((v) => applyDeletion(v, del));
      setSel(0);
      return;
    }
    if (isPrintable(input, key)) {
      setQuery((v) => v + input);
      setSel(0);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={c.accent} paddingX={1} width={60}>
      <Box>
        <Text color={c.accent}>: </Text>
        <Text color={c.text}>{query}</Text>
        <Text color={c.accent}>▏</Text>
      </Box>
      {filtered.length === 0 ? (
        <Text color={c.muted}>no matching command</Text>
      ) : (
        filtered.map((cmd, i) => {
          const on = i === clamped;
          return (
            <Text key={cmd.id} color={on ? c.bg0 : c.text} backgroundColor={on ? c.accent : undefined}>
              {on ? "▸ " : "  "}
              {cmd.label}
            </Text>
          );
        })
      )}
    </Box>
  );
}
