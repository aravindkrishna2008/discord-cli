# discord-cli

Terminal Discord client for DMs. Two-pane Ink TUI with vim-style keybinds, inline image rendering, and a Playwright-assisted login flow.

> ⚠️ Uses a selfbot (user-token) library. This violates Discord's Terms of Service and can get your account flagged or banned. Use at your own risk.

## Install

```sh
npm install
npx playwright install chromium
npm run build
npm link   # optional, exposes `discord-cli` on your PATH
```

Requires Node 20+.

## Usage

```sh
discord-cli login            # headed Chromium, auto-extracts token
discord-cli login --manual   # paste a token instead
discord-cli                  # launch the TUI
discord-cli logout           # delete the stored token
```

## Command Mode

The command surface is shared. Direct commands and `discord-cli shell` are generated from the same command specs, and the TUI uses the same session/runtime DM actions for loading history and sending messages. If you change a command or DM operation in the shared layer, the shell, direct CLI, and terminal UI stay aligned.

Use direct commands for one-shot automation:

```sh
discord-cli status --json
discord-cli list --json
discord-cli use "Alice" --json
discord-cli messages 10 --dm "Alice" --json
discord-cli send "hello" --dm "Alice" --json
discord-cli refresh --json
```

Use shell mode when several related requests should share one Discord session:

```sh
discord-cli shell
```

Example shell session:

```text
dm> list
dm> use Alice
dm> messages 10
dm> send hello
dm> quit
```

Prefer `--channel-id` over `--dm` once a prior step has resolved the target.
Use `discord-cli shell --json` for machine-driven sessions.

### Shared implementation

- Command definitions live in `src/commands/registry.ts`.
- Direct CLI registration is derived from that metadata in `src/commands/cli.ts`.
- Shell mode executes the same handlers through `src/shell/repl.ts`.
- Shared DM/session behavior lives in `src/runtime/session.ts` and `src/runtime/dm-actions.ts`.
- The Ink TUI consumes that same runtime layer instead of maintaining a separate send/history path.

State lives under `~/.discord-cli/`:

- `auth.json` — token + username (mode 600)
- `config.json` — user settings (see below)
- `error.log` — runtime errors

### Config

`~/.discord-cli/config.json`:

```json
{
  "imageProtocol": "auto"
}
```

`imageProtocol`: `"auto" | "iterm" | "kitty" | "halfblock" | "none"`. `auto` picks iTerm2 or Kitty when detected, otherwise half-block.

## Keybinds

**Normal mode**

| Key | Action |
| --- | --- |
| `j` / `k` / `↓` / `↑` | Move selection (list) or scroll (conversation) |
| `h` / `←` | Focus DM list |
| `l` / `→` / `Enter` | Focus conversation |
| `i` | Insert mode (compose) |
| `a-z0-9 ` | Filter DM list |
| `Esc` | Clear filter |
| `q` | Quit |

**Insert mode**

| Key | Action |
| --- | --- |
| `Enter` | Send message |
| `Esc` | Back to normal mode |

Scroll to the top of a conversation to load older messages (50 at a time).

## Development

```sh
npm test         # vitest
npm run typecheck
npm run build    # tsc -> dist/
```

See [`docs/qa.md`](docs/qa.md) for the manual QA checklist.
