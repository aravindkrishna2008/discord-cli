# Manual QA Checklist

Automated tests cover the pure logic; the following flows need a real Discord account and terminal.

## Prerequisites

- `npm install`
- `npx playwright install chromium` (for browser login)
- A Discord account with at least one DM and one group DM
- Terminal: any terminal supported by Ink; browser opening should work on macOS

## Login

- [ ] `discord-cli login` opens a Chromium window at `discord.com/login`
- [ ] After signing in and landing on `/channels/@me`, the window closes and the CLI prints `✔ logged in as <username>`
- [ ] `~/.discord-cli/auth.json` exists with mode `600`
- [ ] `discord-cli login --manual` prompts for a token paste and stores it

## Logout

- [ ] `discord-cli logout` prints `logged out` and removes `~/.discord-cli/auth.json`
- [ ] Running `discord-cli logout` again still prints `logged out` (idempotent)

## Launch without auth

- [ ] `discord-cli` (no auth file) prints `Not logged in. Run 'discord-cli login' first.` and exits non-zero

## TUI: connection + DM list

- [ ] Footer shows `○ connecting` then `● connected`
- [ ] Left pane lists DMs, unread DMs first, group DMs show `(N)` member count
- [ ] `j`/`k` and `↓`/`↑` move the selection
- [ ] Typing letters/digits filters the list; `Esc` clears the filter
- [ ] `Enter` (or `l`/`→`) moves focus to the conversation

## TUI: conversation

- [ ] Opening a DM fetches the last 50 messages
- [ ] `k` / `↑` at the top triggers a history fetch (`… loading older messages`), prepends 50 more
- [ ] Once the channel beginning is reached, further `↑` is a no-op
- [ ] New messages appear live while the DM is active and you're scrolled to the bottom
- [ ] When scrolled up, incoming messages increment `↓ N new messages` instead of jumping the view
- [ ] Messages to other DMs mark them unread (`●`) in the list

## TUI: sending

- [ ] `i` enters insert mode; typing updates the input
- [ ] `Enter` sends the message; it appears in the conversation
- [ ] A send failure shows `! <error>` under the input
- [ ] `Esc` returns to normal mode and clears any send error

## Image shortcuts

- [ ] Visible image attachments render as numbered rows like `[1] image.png`
- [ ] Pressing `1` through `9` opens the matching visible image in the browser
- [ ] If more than 9 images are visible, only the first 9 are numbered
- [ ] Non-image attachments do not receive numeric shortcuts

## Exit + error log

- [ ] `q` in normal mode exits cleanly
- [ ] Network / client errors are appended to `~/.discord-cli/error.log` with a timestamp
