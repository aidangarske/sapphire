import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import { deletionKind, applyDeletion, isPrintable } from "../textedit.ts";
import { useInputLock } from "../inputLock.ts";

export function Prompt({
  label,
  initial = "",
  onSubmit,
  onCancel,
}: {
  label: string;
  initial?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const c = useTheme();
  const [value, setValue] = useState(initial);
  useInputLock();

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      onSubmit(value);
      return;
    }
    const del = deletionKind(input, key);
    if (del) {
      setValue((v) => applyDeletion(v, del));
      return;
    }
    if (isPrintable(input, key)) setValue((v) => v + input);
  });

  return (
    <Box>
      <Text color={c.accent}>{label} </Text>
      <Text color={c.text}>{value}</Text>
      <Text color={c.accent}>▏</Text>
    </Box>
  );
}
