import type { Key } from "ink";

export type DeleteKind = "char" | "word" | "line" | null;

// Classify a keypress as a text deletion. Word = Option/Alt+Backspace or Ctrl+W;
// line = Ctrl+U (also Cmd+Backspace when the terminal maps it to Ctrl+U).
export function deletionKind(input: string, key: Key): DeleteKind {
  if (key.ctrl && input === "u") return "line";
  if ((key.backspace && key.meta) || (key.ctrl && input === "w")) return "word";
  if (key.backspace || key.delete) return "char";
  return null;
}

export function applyDeletion(value: string, kind: DeleteKind): string {
  switch (kind) {
    case "line":
      return "";
    case "word":
      return value.replace(/\s+$/, "").replace(/[^\s]+$/, "");
    case "char":
      return value.slice(0, -1);
    default:
      return value;
  }
}

// True when input is normal text to append — a char or a paste. Rejects modifier
// combos and anything with control/escape bytes (e.g. mouse-tracking sequences),
// so wheel/click events never leak into a text box while still allowing pastes.
export function isPrintable(input: string, key: Key): boolean {
  if (!input || key.ctrl || key.meta || key.escape || key.return) return false;
  return !/[\x00-\x1f\x7f]/.test(input);
}
