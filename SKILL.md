---
name: discord-cli
description: Use this skill when working with this repository's Discord automation surface. Prefer `discord-cli` direct commands with `--json` for one-shot actions, and use `discord-cli shell --json` only when several related DM operations should share one live session.
---

# discord-cli

Use `discord-cli` to inspect DMs, resolve conversations, fetch recent messages, and send messages without driving the Ink TUI.

The command surface is shared: direct CLI commands and `discord-cli shell` come from the same command specs, and the TUI uses the same runtime DM actions for session bootstrapping, history fetches, and sends.

## Preferred workflow

Prefer direct commands for one-shot actions:

```sh
discord-cli status --json
discord-cli list --json
discord-cli use "Alice" --json
discord-cli messages 10 --dm "Alice" --json
discord-cli send "hello" --dm "Alice" --json
discord-cli refresh --json
```

Use shell mode only when several related requests benefit from one reused Discord session:

```sh
discord-cli shell --json
```

Then send line-oriented commands:

```text
list
use Alice
messages 10
send hello
quit
```

## Rules

- Prefer `--json` for automation. Do not rely on decorative text output if JSON is available.
- Prefer direct commands over shell mode unless connection reuse materially helps.
- Prefer `--channel-id` over `--dm` after a DM has been resolved once.
- Do not automate the Ink TUI unless the user explicitly asks for TUI interaction.
- Treat non-zero exits and JSON responses with `"ok": false` as failures.
- If a DM name is ambiguous, resolve it before retrying.
- When changing the automation surface, update the shared command/runtime layer rather than adding shell-only or TUI-only behavior.

## Targeting

- Direct mode: use `--channel-id` or `--dm`.
- Shell mode: use `use <query>` to set the current DM, or pass `--channel-id` / `--dm` explicitly.
- `messages` and `send` use this precedence:
  1. `--channel-id`
  2. `--dm`
  3. current DM from `use` in shell mode

## Common sequences

Resolve a DM and fetch messages:

```sh
discord-cli list --json
discord-cli use "Alice" --json
discord-cli messages 10 --dm "Alice" --json
```

Send a message after resolution:

```sh
discord-cli send "hello" --channel-id 123456789 --json
```
