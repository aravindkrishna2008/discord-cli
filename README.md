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
discord-cli login            # headed Chromium, auto-extracts token, the current implementation does not work
discord-cli login --manual   # paste a token instead
discord-cli                  # launch the TUI
discord-cli logout           # delete the stored token
```

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
