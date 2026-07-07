export interface Saver {
  schedule(path: string, text: string): void;
  flush(): Promise<void>;
  cancelFor(path: string): void;
}

// Debounced note writer. flush() persists any pending write immediately (used
// before switching notes, renaming, or unmounting) so edits are never dropped.
export function createSaver(
  write: (path: string, text: string) => Promise<void>,
  delay = 400,
): Saver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { path: string; text: string } | null = null;
  return {
    schedule(path, text) {
      clearTimeout(timer);
      pending = { path, text };
      timer = setTimeout(() => {
        const p = pending;
        pending = null;
        if (p) void write(p.path, p.text);
      }, delay);
    },
    async flush() {
      clearTimeout(timer);
      const p = pending;
      if (!p) return;
      pending = null;
      await write(p.path, p.text);
    },
    cancelFor(path) {
      if (pending?.path === path) {
        clearTimeout(timer);
        pending = null;
      }
    },
  };
}
