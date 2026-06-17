# Development

## Setup

Requires macOS with Xcode Command Line Tools, Rust, and Node 18+.

```sh
npm install
npm run tauri dev     # live-reloading dev window
```

The one-command path (installs missing toolchains too): `npm run setup`.

## Common commands

| Command | What it does |
| --- | --- |
| `npm run tauri dev` | Run the app with hot reload |
| `npm run build` | Typecheck (tsc) + bundle (vite) |
| `npm test` | Vitest (parser round-trip, note-save lifecycle, date parsing) |
| `npm run format` / `format:check` | Prettier write / check |
| `npm run app:install` | Build release `Sapphire.app` → `/Applications` |
| `cargo fmt --manifest-path src-tauri/Cargo.toml` | Format Rust |

## Layout

```
src/
  App.tsx                 app shell, tab routing, global shortcuts
  components/             notes/ tasks/ prs/ calendar/ + Settings
  lib/                    store, github, calendar, watcher, notify, journal,
                          taskParser (board <-> Markdown), createEditor, markdown
  styles/                 design tokens + per-area CSS
src-tauri/src/
  lib.rs                  Tauri commands (files, create_note, github_*, google_*,
                          fetch_ics, notify_open)
  github.rs               GitHub via the `gh` CLI
  gcal.rs                 Google Calendar OAuth + API
```

## Conventions

- Frontend = Preact + TypeScript; backend = Rust (Tauri commands).
- Source of truth is plain Markdown on disk, so keep it **local-first**, no servers.
- Integrations shell out to existing tools (`gh`, `curl`) instead of embedding
  credentials where possible.
- `taskParser` must round-trip an unmodified `board.md` **byte-identically**
  (covered by `npm test`).

## Notifications

The Tauri notification plugin's desktop banner has no click callback, so clickable
alerts (open the PR on click) go through `notify_open` in `lib.rs`, which uses
`mac-notification-sys` with `wait_for_click` and runs `open <url>` on the click.
Alerts without a link (some calendar reminders) fall back to a plain banner.
