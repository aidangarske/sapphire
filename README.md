# Sapphire

A fast, lightweight terminal workspace: Markdown **notes**, a **task board**, and your **GitHub PRs** — all in one keyboard-driven TUI that runs anywhere (macOS, Linux, Raspberry Pi).

Type `sapphire` to open the interactive UI, or use the same actions as plain
subcommands for scripts and CI. Every note and task is a plain `.md` file on your
disk — no account, no database, no lock-in.

```
 ◈ Sapphire   1 Notes   2 Board   3 PRs                      Sapphire · ~/notes
```

## Install

Sapphire ships as a single self-contained binary — no runtime to install.
Download the one for your platform from the [releases page](../../releases):

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | `sapphire-macos-arm64` |
| macOS (Intel) | `sapphire-macos-x64` |
| Linux (x86_64) | `sapphire-linux-x64` |
| Linux / Raspberry Pi (64-bit ARM) | `sapphire-linux-arm64` |

**macOS**

```sh
chmod +x sapphire-macos-arm64
xattr -dr com.apple.quarantine sapphire-macos-arm64   # it's unsigned
sudo mv sapphire-macos-arm64 /usr/local/bin/sapphire
sapphire
```

**Linux**

```sh
chmod +x sapphire-linux-x64
sudo mv sapphire-linux-x64 /usr/local/bin/sapphire
sapphire
```

**Raspberry Pi** (64-bit Raspberry Pi OS — `uname -m` shows `aarch64`)

```sh
chmod +x sapphire-linux-arm64
sudo mv sapphire-linux-arm64 /usr/local/bin/sapphire
sapphire
```

**Or with [Bun](https://bun.sh)** (any platform):

```sh
git clone https://github.com/aidangarske/sapphire.git && cd sapphire
bun install
bun run build        # -> dist/sapphire (or: bun run src/index.ts)
```

Optional: install the [GitHub CLI](https://cli.github.com) and run `gh auth login`
for the PR features. Notes open in your `$EDITOR` (defaults to `vim`).

## Use it

Run `sapphire` with no arguments for the interactive UI:

- **Notes** — a list of notes with a live Markdown preview. `j`/`k` switch notes,
  the wheel or `↑`/`↓` scroll the open note, `e` edits it in `$EDITOR`. Drag to
  select + copy works normally.
- **Board** — a kanban board backed by `tasks/board.md`. `↑`/`↓` pick a card,
  `<`/`>` move it between columns, `space` completes it, `Enter` shows details.
- **PRs** — your GitHub PRs grouped by category with CI status. `Enter` opens one
  in the browser, `t` files it as a task. PRs you authored or that request your
  review are auto-added to Todo.

Press `?` for the full keymap, `:` for the command palette, `q` to quit.

## Scripting

Everything is also a subcommand. Add `--json` for machine-readable output and
`-w <path>` to target a workspace:

```sh
sapphire note new "Release checklist"   # create a note, print its path
sapphire board                          # print the active board
sapphire board add Todo "Ship it #release"
sapphire board done 3                   # complete task #3
sapphire pr --json                      # your PRs as JSON
sapphire pr sync                        # file authored/review PRs into Todo
sapphire log today                      # append today's activity to the daily note
sapphire watch                          # resident: PR notifications + nightly clear
```

`sapphire watch` (or `sapphire watch --once` from cron/launchd/systemd) sends
desktop notifications on CI failures/fixes and review requests even when the UI
isn't open. Run `sapphire --help` for the full command list.

## Workspace

A workspace is just a folder:

```
notes/    # each note is a .md file
tasks/    # board.md (+ extra boards), kanban stored as `- [ ]` markdown
config/   # index + per-workspace state (JSON)
```

Sapphire finds it via `-w <path>`, `$SAPPHIRE_WORKSPACE`, the current directory
(walking up), or your saved default (`sapphire workspace use <path>`).

## Develop

```sh
bun install
bun run src/index.ts        # run from source
bun test src/core src/tui   # unit + render/input tests
bun run typecheck
bun run build               # compile a standalone binary
```

Built with [Bun](https://bun.sh) + [Ink](https://github.com/vadimdemedes/ink).
See [CONTRIBUTING.md](CONTRIBUTING.md) for the architecture.

## License

MIT, Aidan Garske. See [LICENSE](LICENSE).
