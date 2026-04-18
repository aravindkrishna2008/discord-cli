# discord-cli — Design

**Date:** 2026-04-17
**Status:** Approved, ready for implementation planning

## Goal

A terminal Discord client that lets the user read and send DMs from the CLI,
inspired by [instagram-cli](https://github.com/supreme-gg-gg/instagram-cli).
Scope is deliberately narrow: **direct messages only** (1:1 and group DMs),
text-only, with inline rendering of received images.

## Approach & TOS note

The client uses the user's own Discord account via an unofficial
selfbot library. This is the same approach instagram-cli takes against
Instagram and carries the same risk: it violates Discord's TOS and can
result in account termination. The user has explicitly accepted this
tradeoff in exchange for the real-account UX (their DMs, their friends).

## Stack

- **Runtime:** Node.js 20+, TypeScript
- **TUI:** [Ink](https://github.com/vadimdemedes/ink) (React for terminals)
- **Discord:** [`discord.js-selfbot-v13`](https://github.com/aiko-chan-ai/discord.js-selfbot-v13) — REST + gateway
- **Login automation:** [`playwright`](https://playwright.dev) (headed Chromium)
- **Image rendering:** [`terminal-image`](https://github.com/sindresorhus/terminal-image) (iTerm2 / Kitty / halfBlock fallback)
- **CLI:** `commander`
- **State/config:** plain JSON under `~/.discord-cli/`

## Project layout

```
bin/discord-cli          CLI entrypoint (commander)
  ├─ login               Playwright flow → writes auth.json
  ├─ logout              clears auth.json
  └─ (default)           launches Ink TUI

src/
  auth/                  token read/write, playwright login, manual-paste fallback
  discord/               wrapper around discord.js-selfbot-v13: client, events, DM fetch, send, history
  tui/                   Ink components: App, DMList, Conversation, Input, ImageView, Footer
  store/                 in-memory state: DMs, unread map, activeDmId, messages per DM, scroll state
  config/                load/save config.json
```

The boundary that matters: `discord/` owns all Discord I/O, `tui/` owns
all rendering, `store/` is the single source of truth both sides read
and write. Swapping the library or the UI stays local.

## Feature scope (v1)

**In:**
- Login via Playwright-driven browser (user logs in normally in a real
  Chromium window; token extracted from IndexedDB/localStorage on
  successful redirect to `/channels/@me`). Manual-paste fallback if
  extraction fails or Playwright is unavailable.
- Logout (clears local token; does not revoke server-side).
- List all DMs (1:1 and group) in the left pane, sorted by most recent
  activity, with unread indicator (`●`) and group-DM member count.
- Open a DM and see recent messages in the right pane.
- Send text messages.
- Live updates via Discord gateway (`messageCreate` events); new
  messages appear in the active DM instantly; background DMs get the
  unread marker.
- **Scrollback loads more history on demand** (50 at a time, paginated
  via `before: oldestLoadedId`).
- Inline rendering of received images via `terminal-image`, with
  protocol auto-detected (iTerm / Kitty / halfBlock). Fallback to a
  text placeholder `[image: name.png (size)]` on failure.
- Auto-reconnect via the library; footer status indicator shows
  `● connected` / `○ reconnecting…`.
- Unread indicator on DM list only — no terminal bell, no desktop
  notifications.

**Explicitly out of v1:**
- Servers / guild text channels / threads
- Voice, video, screen share
- Reactions, replies, message edits/deletes, typing indicators
- Sending attachments, emoji shortcodes
- Desktop notifications, terminal bell
- Multi-account / account switching

## Data flow

**Startup**
1. CLI reads `~/.discord-cli/auth.json`. Missing → print "Run `discord-cli login` first" and exit.
2. Create selfbot Client, `client.login(token)`.
3. On `ready`: fetch `client.channels` filtered to DM + Group DM; populate store with `{id, name, lastMessageId, unread: false}`.
4. Ink TUI mounts, subscribes to store.

**Focusing a DM**
1. Store sets `activeDmId`.
2. If messages not cached for that DM, fetch last 50 via `channel.messages.fetch({limit: 50})`.
3. Conversation pane renders newest-at-bottom; images rendered inline via `terminal-image`.
4. `unread` cleared for that DM.

**Scrolling up past oldest loaded message**
1. Fire `channel.messages.fetch({limit: 50, before: oldestLoadedId})`.
2. Show `… loading older messages` indicator while in flight.
3. Prepend returned messages to the cached list; reposition scroll to keep the user's view stable.
4. Repeat until channel history is exhausted.

**Incoming gateway `messageCreate`**
1. If channel is DM/group, append to store for that DM.
2. If that DM is `activeDmId`: re-render conversation pane. Auto-scroll to bottom **only if the user was already at the bottom** — if they've scrolled up to read history, keep their view stable and show a `↓ N new messages` indicator at the bottom edge.
3. Otherwise: set `unread: true`; left pane re-renders.

**Sending a message**
1. Read input buffer, clear it.
2. `channel.send(text)`.
3. Gateway echoes back via `messageCreate` — no optimistic insert, avoids dedupe logic.
4. On send failure, preserve input text and show error line below input.

**Disconnect**
- Library auto-reconnects; footer toggles `● connected` / `○ reconnecting…`.

## Login flow (Playwright)

1. `discord-cli login`.
2. Check for Playwright's bundled Chromium; if missing, prompt to run `npx playwright install chromium`.
3. Launch headed Chromium, navigate to `https://discord.com/login`.
4. User logs in normally — captcha, 2FA, email codes are handled in Discord's own UI.
5. Poll for URL = `https://discord.com/channels/@me` (post-login landing).
6. Extract token by evaluating a page script:
   - Try IndexedDB (`cookieStorage` DB → `token` key).
   - Fall back to `localStorage.getItem('token')`.
7. Close browser, write `{token, createdAt, username}` to `~/.discord-cli/auth.json` (chmod 600). Print `✔ logged in as <username>`.
8. On extraction failure: print manual-paste fallback instructions and prompt the user to paste the token directly.

**`logout`**: deletes `auth.json`. Does not revoke server-side (user can do that in Discord settings).

## TUI layout

```
┌─ discord-cli ─────────────────────────────────────────────────┐
│ DMs                    │ #alice-jones                         │
│ ● alice-jones          │ ──────────────────────────────────── │
│   bob                  │ alice 14:22                          │
│ ● study-group (3)      │   hey are you around?                │
│   mom                  │ you 14:25                            │
│   carol                │   yep what's up                      │
│   ...                  │ alice 14:25                          │
│                        │   [inline image rendered here]       │
│                        │                                      │
│                        │ > type a message_                    │
├────────────────────────┴──────────────────────────────────────┤
│ ● connected · j/k: nav · Enter: open · i: input · q: quit    │
└───────────────────────────────────────────────────────────────┘
```

- Left pane ~30 cols: DM list, unread marked `●`, group DM shows member count.
- Right pane: scrollback + input at bottom; author + time on one line, content below.
- Footer: connection status + contextual keybind hints.

## Keybinds

Two modes: **normal** and **insert**. Arrow keys and vim keys both work.

| Normal mode key | Action |
|---|---|
| `j` / `↓` | Move down in focused pane |
| `k` / `↑` | Move up in focused pane |
| `h` / `←` | Focus DM list |
| `l` / `→` | Focus conversation |
| `Enter` | Open selected DM (from list) / enter insert mode (in conversation) |
| `i` | Enter insert mode |
| `g` / `Home` | Jump to top of conversation (loads more history if at top of cache) |
| `G` / `End` | Jump to bottom of conversation |
| `Ctrl-U` / `PgUp` | Half-page scroll up |
| `Ctrl-D` / `PgDn` | Half-page scroll down |
| `/` | Filter DM list by name |
| `q` or `:q` | Quit |
| `Esc` | Cancel filter / drop out of insert mode |

| Insert mode key | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | Newline in message |
| `Esc` | Back to normal mode |

## Config file

`~/.discord-cli/config.json`:

```json
{
  "imageProtocol": "auto",
  "initialHistory": 50,
  "theme": {"unread": "yellow", "author": "cyan", "time": "gray"}
}
```

`imageProtocol`: `auto` | `iterm` | `kitty` | `halfblock` | `none`. (`auto` detects the terminal: iTerm2 → iterm, Kitty → kitty, otherwise halfBlock.)

## Error handling

- **Invalid/expired token:** TUI exits with `✘ token rejected — run 'discord-cli login'`. No retry loop.
- **Network outage:** library reconnects; footer flips to `○ reconnecting…`. No dialog.
- **Send failure:** error line below input; input text preserved for retry.
- **Image render failure:** fall back to `[image: filename (size)]` placeholder.
- **Playwright missing at login:** prompt to install; fall back to manual token paste if declined.
- **Storage extraction fails:** clear message + manual-paste prompt.
- **Uncaught exceptions:** logged to `~/.discord-cli/error.log`; TUI exits with one-line message pointing at the log. No stack traces in the UI.

## Testing strategy

- **Unit (vitest):** store reducers (unread tracking, message append, scroll state), config load/save, auth file read/write, image-protocol detection.
- **Integration:** mock the selfbot Client (fake `messageCreate` events, fake `channels.fetch` results); assert store transitions and component output via `ink-testing-library`.
- **Manual:** login flow and image rendering tested by hand against a real account. One documented QA checklist in `docs/qa.md`.
- **No end-to-end tests against real Discord** — scripted traffic against user-token endpoints risks the account.

## Security notes

- `auth.json` chmod 600, placed under `~/.discord-cli/` (created 700).
- Token never logged, never printed, never included in `error.log`.
- Playwright browser session isolated to a fresh profile created per login; disposed after token extraction.
