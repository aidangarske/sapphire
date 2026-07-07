import { useEffect } from "react";

// While a text-entry box (Prompt, command palette, y/n confirm) is open, the
// app's global single-key shortcuts must not fire — otherwise typing "t" cycles
// the theme, "q" quits, etc. Any modal input holds this lock while mounted; the
// global useInput handler checks `inputLocked()` and no-ops when held.
let count = 0;

export function inputLocked(): boolean {
  return count > 0;
}

export function useInputLock(): void {
  useEffect(() => {
    count++;
    return () => {
      count = Math.max(0, count - 1);
    };
  }, []);
}
