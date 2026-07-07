import { basename } from "node:path";
import { requireWorkspace } from "../context.ts";
import { ok, fail } from "../output.ts";
import { flagBool } from "../args.ts";
import * as notes from "../../services/notes.ts";
import { openInEditor } from "../../platform/editor.ts";
import type { ParsedArgs } from "../args.ts";

function resolvePath(ws: string, ref: string): string | null {
  if (/^\d+$/.test(ref)) return notes.resolveNoteId(ws, Number(ref));
  const list = notes.listOrderedNotes(ws);
  const hit =
    list.find((n) => n.name === ref) ??
    list.find((n) => n.name === `${ref}.md`) ??
    list.find((n) => n.name.replace(/\.md$/, "").toLowerCase() === ref.toLowerCase());
  return hit?.path ?? null;
}

export function noteCommand(sub: string, args: ParsedArgs): void {
  const ws = requireWorkspace(args.flags);
  const rest = args.positionals;

  switch (sub) {
    case "ls":
    case "list": {
      const list = notes.listOrderedNotes(ws);
      ok(list, (r) =>
        r.map((n: any) => `#${n.id}\t${n.name.replace(/\.md$/, "")}`).join("\n") || "(no notes)",
      );
      return;
    }
    case "new":
    case "create": {
      const title = rest.join(" ").trim() || "Untitled";
      const path = notes.createNote(ws, title);
      ok({ path, name: basename(path) }, (r) => r.path);
      return;
    }
    case "search": {
      const q = rest.join(" ");
      const hits = notes.searchNotes(ws, q);
      ok(hits, (r) =>
        r
          .map((h: any) => `${h.name.replace(/\.md$/, "")}${h.line ? `:${h.line}` : ""}  ${h.snippet}`)
          .join("\n") || "(no matches)",
      );
      return;
    }
    case "open":
    case "edit": {
      const ref = rest[0];
      if (!ref) fail("bad-args", "usage: sapphire note open <id|name>");
      const path = resolvePath(ws, ref);
      if (!path) fail("not-found", `no note matching '${ref}'`);
      if (flagBool(args.flags, "print", "p")) {
        ok({ path }, (r) => r.path);
        return;
      }
      openInEditor(path);
      ok({ path }, () => "");
      return;
    }
    case "cat":
    case "show": {
      const ref = rest[0];
      if (!ref) fail("bad-args", "usage: sapphire note show <id|name>");
      const path = resolvePath(ws, ref);
      if (!path) fail("not-found", `no note matching '${ref}'`);
      const body = notes.readNote(path);
      ok({ path, body }, (r) => r.body);
      return;
    }
    case "rename": {
      const ref = rest[0];
      const name = rest.slice(1).join(" ");
      if (!ref || !name) fail("bad-args", "usage: sapphire note rename <id|name> <new name>");
      const path = resolvePath(ws, ref);
      if (!path) fail("not-found", `no note matching '${ref}'`);
      const newPath = notes.renameNote(ws, path, name);
      ok({ path: newPath }, (r) => r.path);
      return;
    }
    case "rm":
    case "delete": {
      const ref = rest[0];
      if (!ref) fail("bad-args", "usage: sapphire note rm <id|name>");
      const path = resolvePath(ws, ref);
      if (!path) fail("not-found", `no note matching '${ref}'`);
      notes.deleteNote(path);
      ok({ deleted: path }, (r) => `deleted ${basename(r.deleted)}`);
      return;
    }
    default:
      fail("bad-args", `unknown: note ${sub}`);
  }
}
