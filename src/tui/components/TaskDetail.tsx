import { Box, Text, useInput } from "ink";
import { useTheme } from "../useTheme.tsx";
import { useInputLock } from "../inputLock.ts";
import type { Task } from "../../core/board.ts";

export function TaskDetail({
  task,
  column,
  onClose,
  onOpenPr,
  onEdit,
}: {
  task: Task;
  column: string;
  onClose: () => void;
  onOpenPr: () => void;
  onEdit: () => void;
}) {
  const c = useTheme();
  useInputLock();
  useInput((input, key) => {
    if (key.escape || key.return) onClose();
    else if (input === "o" && task.pr) onOpenPr();
    else if (input === "e") onEdit();
  });

  const title = task.title.replace(/#[\w-]+/g, "").replace(/\s+/g, " ").trim() || "(untitled)";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={c.accent} paddingX={2} paddingY={1} width={72}>
      <Text color={task.checked ? c.ok : c.accent} bold>
        {task.checked ? "✓ " : "☐ "}
        {title}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text color={c.muted}>
          column: <Text color={c.text}>{column}</Text>
        </Text>
        {task.tags.length > 0 && (
          <Text color={c.muted}>
            tags: <Text color={c.accentHi}>{task.tags.map((t) => `#${t}`).join(" ")}</Text>
          </Text>
        )}
        {task.refs.length > 0 && (
          <Text color={c.muted}>
            note refs: <Text color={c.accentHi}>{task.refs.map((r) => `#${r}`).join(" ")}</Text>
          </Text>
        )}
        {task.due && (
          <Text color={c.muted}>
            due: <Text color={c.text}>{task.due}</Text>
          </Text>
        )}
        {task.pr && (
          <Text color={c.muted}>
            PR: <Text color={c.accent}>{task.pr}</Text>
          </Text>
        )}
      </Box>
      {task.body && (
        <Box marginTop={1} flexDirection="column">
          <Text color={c.muted}>notes:</Text>
          {task.body.split("\n").map((line, i) => (
            <Text key={i} color={c.text}>
              {line || " "}
            </Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={c.muted}>
          {task.pr ? "o open PR · " : ""}e edit · Esc close
        </Text>
      </Box>
    </Box>
  );
}
