# Sapphire

A fast, simple, **local-first dev workspace for Mac**. Markdown notes that render
as you type, a Jira-style task board, your GitHub PRs with CI status, native
failure notifications, and your Google Calendar — in one small native app. All
your data is plain `.md` files on disk; the app is just a clean face over them.

> Status: early development (v0.1, pre-release).

## Features

- **Notes** — split raw/rendered Markdown editor, full-text search, numbered
  notes (`#N`), drag-to-reorder, rename, delete.
- **Tasks** — a board backed by `- [ ]` Markdown (`tasks/board.md`): columns
  (Todo / In Progress / Blocked / Done / Want To Do), drag between columns,
  per-task colors, priority numbers, tags, notes, and a per-PR "create task".
- **Pull Requests** — your GitHub PRs via the `gh` CLI (no token to paste),
  grouped by Created / Needs attention / Review requested / Assigned, with CI
  rollup, cached + auto-refreshing.
- **Notifications** — native macOS alerts on CI failed/fixed, review requested,
  changes requested, and calendar reminders; click to open the PR/Meet link.
- **Calendar** — a day-view timeline of your Google Calendar (read-only).
- **Daily log** — board activity (done/blocked/in-progress) is appended to a
  daily note automatically and on demand.

## Install (macOS)

One command — installs any missing prerequisites (Xcode CLT, Rust, Node), builds
the app, and copies it to `/Applications`:

```sh
git clone <your-repo-url> sapphire && cd sapphire
npm run setup
```

First launch: right-click **Sapphire** in Applications → **Open** (it's unsigned).

## Connect your accounts

- **GitHub:** `gh auth login` in a terminal (uses the GitHub CLI — nothing to
  paste in the app).
- **Google Calendar:** see [Docs/CALENDAR-SETUP.md](Docs/CALENDAR-SETUP.md).

## Develop

```sh
npm install
npm run tauri dev     # live-reloading dev window
npm test              # parser round-trip tests
npm run app:install   # rebuild release app into /Applications
```

## Stack

[Tauri v2](https://tauri.app) (system WebView — small, fast) · Preact + TypeScript
+ Vite · CodeMirror 6 · `gh` / `curl` for integrations. Notes/tasks are plain
Markdown; secrets/tokens are handled by `gh` and Google OAuth, stored locally.

## Shortcuts

- **Cmd+1–5** — switch tabs · **Cmd+N** — new note
- **⌥+1–9 / ⌥+] [** — jump / cycle notes
- **Cmd+A** — select all (in the editor)

## License

MIT © Aidan Garske — see [LICENSE](LICENSE).
