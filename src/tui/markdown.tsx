import React from "react";
import { Text } from "ink";
import type { ThemeTokens } from "./theme.ts";

// Lightweight markdown -> Ink line renderer for the read-only preview. Not a
// full parser: headings, checkboxes, bullets, quotes, code fences, hr. Inline
// **bold**/`code` are left as-is to stay fast and predictable.
export function renderMarkdownLines(src: string, c: ThemeTokens): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let inFence = false;
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = `l${i}`;

    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      out.push(<Text key={key} color={c.muted}>{line}</Text>);
      continue;
    }
    if (inFence) {
      out.push(<Text key={key} color={c.accentHi}>{line}</Text>);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      out.push(
        <Text key={key} color={c.accent} bold>
          {h[2]}
        </Text>,
      );
      continue;
    }
    const task = line.match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
    if (task) {
      const done = task[2].toLowerCase() === "x";
      out.push(
        <Text key={key}>
          {task[1]}
          <Text color={done ? c.ok : c.muted}>{done ? "✓ " : "☐ "}</Text>
          <Text color={done ? c.muted : c.text} strikethrough={done}>
            {task[3]}
          </Text>
        </Text>,
      );
      continue;
    }
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      out.push(
        <Text key={key}>
          {bullet[1]}
          <Text color={c.accent}>• </Text>
          <Text color={c.text}>{bullet[2]}</Text>
        </Text>,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      out.push(
        <Text key={key} color={c.muted} italic>
          {line}
        </Text>,
      );
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push(<Text key={key} color={c.border}>{"─".repeat(24)}</Text>);
      continue;
    }
    // Plain body text is left uncolored (terminal default fg) — this removes a
    // truecolor escape per line, which is the bulk of the preview's byte weight.
    out.push(<Text key={key}>{line || " "}</Text>);
  }
  return out;
}
