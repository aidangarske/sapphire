# Contributing to Sapphire

Thanks for your interest!

## Dev setup

Requires macOS with Xcode Command Line Tools, Rust, and Node 18+.

```sh
npm install
npm run tauri dev
```

## Tests

```sh
npm test          # vitest
npm run build     # typecheck + bundle
```

The task-board parser (`src/lib/taskParser.ts`) must **round-trip
byte-identically**: an unmodified `board.md` parsed and re-serialized must equal
the original. Keep that invariant green.

## Conventions

- Frontend is Preact + TypeScript; backend is Rust (Tauri commands).
- Source of truth is plain Markdown on disk, so keep it **local-first**, no servers.
- Integrations shell out to existing tools (`gh`, `curl`) rather than embedding
  credentials where possible.

## Submitting changes

Keep changes focused, run `npm test` and `npm run build`, and describe the
behavior change in the PR.
