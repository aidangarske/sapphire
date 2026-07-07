# Contributing to Sapphire

Thanks for your interest!

## Dev setup

Requires [Bun](https://bun.sh). No Node, Rust, or platform SDK needed.

```sh
bun install
bun run src/index.ts        # run the UI from source
```

## Tests

```sh
bun test src/core src/tui   # unit + render/input tests
bun run typecheck           # tsc --noEmit
bun run build               # compile a standalone binary into dist/
```

The task-board parser (`src/core/board.ts`) must **round-trip byte-identically**:
an unmodified `board.md` parsed and re-serialized must equal the original. Keep
that invariant green (`src/core/board.test.ts`).

## Architecture

Four layers, dependencies point downward only:

- `src/core/` — pure logic, no I/O (board parser, journal, PR GraphQL parse).
- `src/platform/` — side effects (fs with a workspace guard, `gh`, notifier, config).
- `src/services/` — orchestration over core + platform.
- `src/cli/` and `src/tui/` — two front ends. Every UI action is also a subcommand.

Source of truth is plain Markdown on disk — keep it **local-first**, no servers.
Integrations shell out to existing tools (`gh`, `$EDITOR`, the OS notifier)
rather than embedding credentials.

## Submitting changes

Keep changes focused, run the tests and typecheck, and describe the behavior
change in the PR.
