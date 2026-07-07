import type { NotesIndex, NoteEntry, OrderedNote } from "./types.ts";

export const emptyIndex = (): NotesIndex => ({ nextId: 1, order: [], ids: {} });

function isPosInt(n: unknown): n is number {
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0;
}

export function parseIndex(raw: string): NotesIndex {
  try {
    const j = JSON.parse(raw);
    const order =
      Array.isArray(j?.order) && j.order.every((s: unknown) => typeof s === "string")
        ? (j.order as string[])
        : [];
    const ids: Record<string, number> = {};
    if (j?.ids && typeof j.ids === "object" && !Array.isArray(j.ids)) {
      for (const [k, v] of Object.entries(j.ids)) if (isPosInt(v)) ids[k] = v;
    }
    return { nextId: isPosInt(j?.nextId) ? j.nextId : 1, order, ids };
  } catch {
    return emptyIndex();
  }
}

// Assign stable ids to any new files, drop removed ones, keep ordering in sync.
// Returns the reconciled index and whether it changed (so the caller can persist).
export function reconcileIndex(
  idx: NotesIndex,
  entries: NoteEntry[],
): { index: NotesIndex; changed: boolean } {
  const present = new Set(entries.map((e) => e.name));
  let changed = false;

  for (const e of entries) {
    if (idx.ids[e.name] == null) {
      idx.ids[e.name] = idx.nextId++;
      changed = true;
    }
    if (!idx.order.includes(e.name)) {
      idx.order.push(e.name);
      changed = true;
    }
  }
  const trimmed = idx.order.filter((n) => present.has(n));
  if (trimmed.length !== idx.order.length) {
    idx.order = trimmed;
    changed = true;
  }
  for (const name of Object.keys(idx.ids)) {
    if (!present.has(name)) {
      delete idx.ids[name];
      changed = true;
    }
  }
  return { index: idx, changed };
}

export function orderedNotes(idx: NotesIndex, entries: NoteEntry[]): OrderedNote[] {
  const byName = new Map(entries.map((e) => [e.name, e]));
  return idx.order
    .filter((n) => byName.has(n))
    .map((n) => ({ ...byName.get(n)!, id: idx.ids[n] }));
}

export function resolveId(idx: NotesIndex, id: number): string | null {
  return Object.keys(idx.ids).find((n) => idx.ids[n] === id) ?? null;
}
