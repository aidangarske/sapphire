export interface NoteEntry {
  name: string;
  path: string;
  modified: number;
}

export interface OrderedNote extends NoteEntry {
  id: number;
}

export interface SearchHit {
  name: string;
  path: string;
  line: number;
  snippet: string;
  title_match: boolean;
}

export interface NotesIndex {
  nextId: number;
  order: string[];
  ids: Record<string, number>;
}

export type ActAction = "done" | "blocked" | "inprogress";

export interface Activity {
  ts: number;
  date: string; // YYYY-MM-DD
  action: ActAction;
  title: string;
  note?: string;
  pr?: string; // linked PR url, if the task has one
}

export interface BoardFile {
  name: string; // display name (filename without .md)
  path: string;
  isDefault: boolean; // the primary "Daily" board (board.md)
}
