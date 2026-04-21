# discord-cli — Shared Command Surface + Shell Spec

**Date:** 2026-04-20
**Status:** Draft, implementation-facing

## Goal

Add a first-class non-TUI command surface to `discord-cli` while also
introducing a long-lived interactive shell. The direct CLI commands and the
shell commands must be the same commands, backed by the same handlers.

This gives two ways to drive the app:

```sh
discord-cli status
discord-cli list
discord-cli messages --dm "Alice" 20
discord-cli send --dm "Alice" "hello"
```

and:

```sh
discord-cli shell
dm> status
dm> list
dm> use Alice
dm> messages 20
dm> send hello
```

The shell is for compounding requests in one session. The direct commands are
for scripts, skills, and one-shot agent invocations.

## Problem

Today the binary only supports auth commands and a TUI launch path.

Current entrypoint:

```ts
program
  .command("login")
  .description("Log in via a browser (Playwright) or manual token paste")

program
  .command("logout")
  .description("Delete the stored token")

program.action(async () => {
  const auth = readAuth(paths.authFile);
  if (!auth) {
    process.stderr.write("Not logged in. Run 'discord-cli login' first.\n");
    process.exit(1);
  }
  await runTui(auth.token);
});
```

Source: `bin/discord-cli.ts`

That makes the current app usable for a human in the Ink UI, but awkward for
automation. A skill or agent cannot easily ask for "list DMs" or "show the last
20 messages for Alice" without driving the TUI through keypresses.

## Design Principles

- Define commands once and execute them from both direct CLI mode and shell
  mode.
- Keep the TUI as the default `discord-cli` behavior.
- Make direct commands fully usable without entering the shell.
- Allow shell mode to keep session state such as "current DM".
- Prefer explicit machine-stable output with `--json`.
- Use channel IDs as the canonical identifier internally, even if commands
  accept names.
- Do not create separate "shell-only business logic".

## Non-Goals

- Replacing the Ink TUI
- Supporting guild/server channels
- Building a mini-bash with pipes, quoting rules, aliases, or variables
- Adding a daemon or local HTTP server in this phase

## Existing Code We Can Reuse

The Discord client wrapper already provides the key primitives:

```ts
export interface DiscordClient {
  login(token: string): Promise<void>;
  logout(): Promise<void>;
  fetchHistory(channelId: string, beforeId?: string, limit?: number): Promise<Message[]>;
  send(channelId: string, content: string): Promise<void>;
  on<K extends keyof DiscordEvents>(event: K, handler: DiscordEvents[K]): void;
}
```

Source: `src/discord/client.ts`

It also already emits the DM list on `ready`:

```ts
client.on("ready", () => {
  const dmChannels: DM[] = [];
  for (const [, ch] of client.channels.cache) {
    const type = (ch as { type?: string }).type;
    if (type === "DM" || type === "GROUP_DM") {
      dmChannels.push(normalizeChannel(ch as unknown as RawChannel));
    }
  }
  dmChannels.sort((a, b) => {
    const activityDiff = b.lastActivityAt - a.lastActivityAt;
    if (activityDiff !== 0) return activityDiff;
    return a.name.localeCompare(b.name);
  });
  handlers.dms?.(dmChannels);
});
```

This means the new command surface does not need new Discord primitives for the
MVP. It needs orchestration, parsing, resolution, and formatting.

## User-Facing Command Surface

### Direct Commands

These commands should work without entering the shell:

```sh
discord-cli help [command]
discord-cli status [--json]
discord-cli list [--json]
discord-cli current [--json]
discord-cli use <query> [--json]
discord-cli messages [limit] [--dm <query> | --channel-id <id>] [--json]
discord-cli send <text> [--dm <query> | --channel-id <id>] [--json]
discord-cli refresh [--json]
discord-cli shell [--json] [--no-color] [--quiet]
```

Notes:

- `use` is still allowed as a direct command, but in one-shot mode it only
  resolves and prints the chosen DM. It does not persist shell state across
  process invocations.
- `messages` and `send` must support explicit targeting so they remain useful
  outside shell mode.
- `current` in direct mode can return `null` if there is no shell state or
  print a clear "no active DM" response.

### Shell Commands

Inside `discord-cli shell`, expose the same command names except `shell`:

```text
help [command]
status
list
current
use <query>
messages [limit]
send <text>
refresh
quit
```

Examples:

```text
$ discord-cli shell
discord-cli shell
connected as aravind
64 DMs loaded
dm> use Alice
using dm: Alice [123456789]
dm> messages 10
[2026-04-20 10:13] Alice: hey
[2026-04-20 10:14] you: yep
dm> send sounds good
sent
dm> quit
```

## Shared Architecture

The main design requirement is a single command execution path.

### New Modules

Proposed structure:

```text
src/
  commands/
    context.ts
    parser.ts
    registry.ts
    execute.ts
    format.ts
    resolver.ts
    handlers/
      help.ts
      status.ts
      list.ts
      current.ts
      use.ts
      messages.ts
      send.ts
      refresh.ts
  shell/
    repl.ts
  runtime/
    session.ts
```

### Shared Command Types

```ts
export interface CommandInput {
  name: string;
  args: string[];
  flags: Record<string, string | boolean | number | undefined>;
  raw: string;
}

export interface CommandSpec {
  name: string;
  summary: string;
  usage: string;
  needsAuth?: boolean;
  needsConnection?: boolean;
  needsTargetDm?: boolean;
  handler: (input: CommandInput, ctx: CommandContext) => Promise<CommandResult>;
}

export interface CommandResult {
  ok: boolean;
  text?: string;
  data?: unknown;
  exitCode?: number;
}
```

Reasoning:

- `CommandSpec` lets both `help` and execution read from the same source.
- `needsTargetDm` lets the shell executor reject `messages` and `send` early
  when no current DM is set and no explicit target was provided.
- `CommandResult` supports text mode and JSON mode without every handler
  managing stdout directly.

### Shared Runtime Context

```ts
export interface ShellState {
  currentChannelId: string | null;
  currentChannelName: string | null;
}

export interface CommandContext {
  auth: { token: string; username: string };
  client: DiscordClient | null;
  dms: DM[];
  shellState: ShellState;
  outputMode: "text" | "json";
  quiet: boolean;
  isShell: boolean;
}
```

Reasoning:

- The direct CLI can construct a context with empty shell state.
- The shell can reuse the same context object and mutate `shellState`.
- Handlers do not care whether they were called by Commander or the REPL.

## Lifecycle Model

### Direct Command Lifecycle

For direct commands:

1. Parse argv into `CommandInput`
2. Load auth
3. Connect Discord client once if needed
4. Hydrate DM list once if needed
5. Execute command
6. Print result
7. Disconnect

Pseudo-shape:

```ts
const session = await createSession({ reuseConnection: false });
const result = await executeCommand(input, session.context);
await session.close();
renderResult(result, session.context.outputMode);
```

### Shell Lifecycle

For shell mode:

1. Load auth
2. Connect Discord client once
3. Hydrate DM list once
4. Start reading lines from stdin
5. For each line, parse then execute using the same context
6. Keep `shellState.currentChannelId`
7. Disconnect on `quit` or EOF

Pseudo-shape:

```ts
const session = await createSession({ reuseConnection: true, isShell: true });
await runRepl(session.context);
await session.close();
```

The lifecycle differs. The handlers do not.

## Session Hydration

We need a small runtime helper that bridges the existing event-based Discord
client into an awaited "ready + DM list" session initializer.

Suggested shape:

```ts
export async function createSession(opts: {
  isShell: boolean;
  outputMode: "text" | "json";
  quiet?: boolean;
}): Promise<{
  context: CommandContext;
  close(): Promise<void>;
}> {
  const auth = readAuth(paths.authFile);
  if (!auth) throw new Error("Not logged in. Run 'discord-cli login' first.");

  const client = createDiscordClient();
  const dms = await loginAndLoadDms(client, auth.token);

  return {
    context: {
      auth,
      client,
      dms,
      shellState: { currentChannelId: null, currentChannelName: null },
      outputMode: opts.outputMode,
      quiet: !!opts.quiet,
      isShell: opts.isShell,
    },
    async close() {
      await client.logout();
    },
  };
}
```

`loginAndLoadDms(...)` is a thin wrapper around the current `ready` and `dms`
events. This keeps the event orchestration out of the command handlers.

## Parsing

The shell parser should be intentionally simple:

- split first token as command name
- preserve the rest as raw argument text
- support basic `--flag value` and `--flag=value`
- do not attempt to implement shell quoting beyond what Node already gives the
  direct CLI in `process.argv`

Examples:

```text
use Alice
messages 20
messages --dm Alice 20
send hello there
send --dm Alice hello there
```

This is a line-oriented REPL, not a mini-shell.

## Name Resolution

The resolver is the highest-risk part of the UX because display names are not
unique.

Resolution order for `<query>`:

1. exact list index from the last rendered `list`
2. exact channel ID
3. exact case-insensitive DM name
4. partial case-insensitive DM name

If resolution returns multiple matches, fail with an ambiguity result.

Suggested helper:

```ts
export type ResolveDmResult =
  | { kind: "match"; dm: DM }
  | { kind: "none"; query: string }
  | { kind: "ambiguous"; query: string; matches: DM[] };
```

Example ambiguous output:

```text
ambiguous DM name "alex":
1  Alex Johnson [123]
2  alex [456]
3  project-alex (4) [789]
```

The shell should not auto-pick in ambiguous cases.

## Output Modes

### Text Mode

Text mode is for humans:

- short summaries
- readable lists
- simple confirmations such as `sent`
- no stack traces

### JSON Mode

JSON mode is for agents:

- one JSON object per response
- no prompt decoration in machine mode
- no ANSI
- no extra prose before or after the JSON object

Example:

```json
{"ok":true,"command":"status","user":"aravind","connected":true,"dmCount":64}
```

This matters for both direct commands and `discord-cli shell --json`.

## Skill Integration

The command surface is being designed specifically so a future `SKILL.md` can
invoke `discord-cli` directly without driving the Ink TUI through keypresses.

The skill should prefer one-shot direct commands for simple requests and use
`discord-cli shell --json` only when it needs to compound several related
operations in one live session.

### Why This Matters

A skill works best when the command contract is:

- non-interactive by default
- machine-readable with `--json`
- stable across direct mode and shell mode
- explicit about failure modes and exit codes

The implementation should preserve those properties because the skill is a
first-class consumer of this interface.

### What the Future `SKILL.md` Should Include

The eventual `SKILL.md` should document:

1. When to use direct commands vs shell mode
2. The expected JSON-first invocation patterns
3. Targeting rules for DMs
4. Error handling expectations
5. Example command sequences the agent can follow

Suggested content outline:

```md
# discord-cli

## Purpose

Use `discord-cli` to inspect DMs, resolve conversations, fetch messages, and
send messages without using the Ink TUI.

## When to use direct commands

Prefer direct commands for one-shot actions:

```sh
discord-cli status --json
discord-cli list --json
discord-cli messages --dm "Alice" 10 --json
discord-cli send --dm "Alice" "hello" --json
```

## When to use shell mode

Use shell mode when several related requests should share one Discord session:

```sh
discord-cli shell --json
```

Then send line-oriented commands such as:

```text
list
use Alice
messages 10
send hello
quit
```

## Targeting rules

Prefer `--channel-id` when available. Otherwise use `--dm`.
Inside shell mode, `use <query>` may establish the current DM for subsequent
commands.

## Output handling

Prefer `--json` for automation. Do not rely on decorative text output when JSON
mode is available.

## Error handling

Treat non-zero exits and `{"ok":false,...}` results as command failures.
If a DM name is ambiguous, resolve it before retrying.
```

### Skill Guidance for This Project

The spec should shape the skill contract toward these preferences:

- direct command examples must use `--json`
- shell examples must use `discord-cli shell --json`
- the skill should avoid TUI automation unless explicitly requested
- the skill should prefer explicit `--channel-id` over names when a prior step
  has already resolved the DM
- the skill should use shell mode only when connection reuse materially helps

### Command Examples the Skill Should Be Able to Rely On

Direct mode:

```sh
discord-cli status --json
discord-cli list --json
discord-cli use "Alice" --json
discord-cli messages --dm "Alice" 10 --json
discord-cli send --dm "Alice" "hello" --json
```

Shell mode:

```text
list
use Alice
messages 10
send hello
quit
```

### Implementation Requirement From the Skill's Perspective

The `SKILL.md` should not need special-case instructions for shell-only command
semantics. If `messages` means "resolve target, fetch history, format result" in
direct mode, it must mean the same thing in shell mode. The only allowed
difference is where the target DM comes from:

- direct mode: `--channel-id` or `--dm`
- shell mode: `--channel-id`, `--dm`, or current DM from `use`

This constraint should guide the implementation and test coverage.

## Command Semantics

### `status`

Returns:

- authenticated username
- connected/disconnected
- DM count
- shell current DM if applicable

### `list`

Returns DM list ordered by `lastActivityAt`, matching the current sort in
`src/discord/client.ts`.

Text example:

```text
1  Alice
2  Bob
3  Study Group (3)
```

### `use <query>`

In shell mode:

- resolve DM
- set `shellState.currentChannelId`
- set `shellState.currentChannelName`
- print selected DM

In direct mode:

- resolve DM
- print selected DM
- do not persist session state

### `current`

In shell mode:

- print current DM or "no active DM"

In direct mode:

- return `null` or "no active DM"

### `messages [limit]`

Target selection order:

1. `--channel-id`
2. `--dm`
3. `shellState.currentChannelId`

If no target is available, fail with a user-facing error.

Default limit: `20`
Max limit for MVP: `100`

### `send <text>`

Target selection order matches `messages`.

Validation:

- reject empty or whitespace-only text
- preserve the raw rest-of-line content after parsing

Text result:

```text
sent
```

JSON result:

```json
{"ok":true,"command":"send","channelId":"123","sent":true}
```

### `refresh`

Re-fetch or rebuild the DM list from the live client and overwrite
`ctx.dms`. This is useful if a new DM appears after startup.

## Error Model

User-facing command errors should be structured and stable.

Suggested exit codes:

- `1`: generic command failure
- `2`: not logged in
- `3`: target DM not found
- `4`: ambiguous target DM
- `5`: invalid usage
- `6`: send failure

JSON mode should include the code:

```json
{"ok":false,"code":4,"error":"ambiguous DM name","matches":[...]}
```

## Entrypoint Changes

Current file:

- `bin/discord-cli.ts`

Current responsibilities:

- auth commands
- default TUI launch

Proposed responsibilities after refactor:

- auth commands remain here
- direct command names are registered here
- `shell` command is registered here
- the business logic moves into `src/commands/*`

Illustrative shape:

```ts
program.command("status").option("--json").action((opts) =>
  runDirectCommand({ name: "status", args: [], flags: opts }),
);

program.command("list").option("--json").action((opts) =>
  runDirectCommand({ name: "list", args: [], flags: opts }),
);

program.command("shell").option("--json").action((opts) =>
  runShell({ outputMode: opts.json ? "json" : "text" }),
);
```

Commander should only collect argv. It should not hold the command logic.

## REPL Shape

Suggested shell loop:

```ts
for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  if (trimmed === "quit" || trimmed === "exit") break;

  const input = parseShellLine(trimmed);
  const result = await executeCommand(input, ctx);
  renderResult(result, ctx.outputMode);
}
```

If `--json` is set, the shell should suppress the `dm>` prompt or make prompt
emission opt-in. Prompt text is noise for machine consumers.

## Why Shared Handlers Matter

The whole point of this design is to avoid drift like this:

- `discord-cli messages --dm Alice 20` does one thing
- `discord-cli shell` then `messages 20` does a slightly different thing

That drift will happen unless both code paths call the same handler with the
same resolution logic and the same formatter.

The architecture must make the shell a frontend, not a second product.

## Implementation Plan

1. Add `src/runtime/session.ts` to connect once and await initial DM hydration.
2. Add `src/commands/context.ts`, `registry.ts`, `execute.ts`, and
   `resolver.ts`.
3. Implement `status`, `list`, `use`, `current`, `messages`, `send`, and
   `refresh` handlers.
4. Add text and JSON result rendering.
5. Register direct commands in `bin/discord-cli.ts`.
6. Add `src/shell/repl.ts` and the `shell` command.
7. Add tests for:
   - parser behavior
   - DM resolution
   - target precedence
   - direct vs shell execution parity
   - JSON output stability
8. Add a project `SKILL.md` that documents the direct-command and shell-mode
   automation contract, with JSON-first examples and explicit guidance to avoid
   TUI automation unless necessary.

## Test Cases

### Direct Mode

```sh
discord-cli status --json
discord-cli list --json
discord-cli messages --dm "Alice" 5 --json
discord-cli send --dm "Alice" "hello" --json
```

### Shell Mode

```text
help
list
use Alice
current
messages 5
send hello
refresh
quit
```

### Edge Cases

- not logged in
- unknown DM name
- ambiguous DM name
- empty send text
- `messages` without current DM in shell mode
- `messages` with `--channel-id` overriding current DM
- `send` failure from Discord API

## Open Questions

- Whether `current` should persist outside shell mode through a small local
  state file. Current recommendation: no.
- Whether `list` should show IDs by default in text mode. Current
  recommendation: no, unless ambiguity is detected or `--verbose` is added.
- Whether `refresh` should re-fetch by reconnecting or by reading the live
  client's cache. Current recommendation: start with cache-based refresh,
  reconnect only if needed later.

## Recommendation

Implement the shared command registry first, then hang both frontends off it.
That keeps the direct CLI useful for skills and makes `discord-cli shell` a
thin session-oriented wrapper rather than a separate command language.
