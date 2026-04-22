import type { DM, Message } from "../store/types.js";
import type { CommandContext } from "./context.js";
import { createCommandInput } from "./input.js";
import { formatDmLabel, resolveDmQuery, resolveTarget, resolutionError } from "./resolver.js";
import type { CommandInput, CommandResult, CommandSpec } from "./types.js";
import { loadDmDirectory, loadDmMessages, sendDmMessage } from "../runtime/dm-actions.js";

const MAX_MESSAGE_LIMIT = 100;
const JSON_OPTION = { flags: "--json", description: "Emit JSON output" };
const DM_OPTION = { flags: "--dm <query>", description: "Target a DM by name or list index" };
const CHANNEL_ID_OPTION = { flags: "--channel-id <id>", description: "Target a DM by channel id" };
const BEFORE_OPTION = { flags: "--before <id>", description: "Fetch messages before this message ID" };

function ok(text: string, data?: Record<string, unknown>): CommandResult {
  return { ok: true, text, data, exitCode: 0 };
}

function fail(text: string, exitCode = 1, data?: Record<string, unknown>): CommandResult {
  return { ok: false, text, exitCode, data: { ...(data ?? {}), code: exitCode } };
}

function currentDm(ctx: CommandContext): DM | null {
  if (!ctx.shellState.currentChannelId) return null;
  return ctx.dms.find((dm) => dm.id === ctx.shellState.currentChannelId) ?? null;
}

function listText(dms: DM[]): string {
  if (dms.length === 0) return "no DMs";
  return dms.map((dm, idx) => `${idx + 1}  ${formatDmLabel(dm)}`).join("\n");
}

function formatMessage(message: Message): string {
  const timestamp = new Date(message.createdAt);
  const stamp = `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())} ${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}`;
  const body = message.content.trim()
    ? message.content.replace(/\s+/g, " ").trim()
    : message.attachments.length > 0
      ? message.attachments.map((a) => `[attachment: ${a.name}]`).join(" ")
      : "(empty)";
  return `[${stamp}] ${message.authorName}: ${body}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function parseLimit(input: CommandInput): number | CommandResult {
  if (input.args.length === 0) return 20;
  const raw = input.args[0];
  const limit = Number.parseInt(raw, 10);
  if (!Number.isInteger(limit) || limit <= 0 || limit > MAX_MESSAGE_LIMIT) {
    return fail(`limit must be an integer between 1 and ${MAX_MESSAGE_LIMIT}`, 5, {
      error: "invalid limit",
      limit: raw,
    });
  }
  return limit;
}

function getUseQuery(input: CommandInput): string {
  return input.args.join(" ").trim();
}

function getSendText(input: CommandInput): string {
  return input.args.join(" ").trim();
}

function stringArg(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArgs(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function renderHelp(spec?: CommandSpec): string {
  if (spec) {
    return [
      `${spec.name}: ${spec.summary}`,
      `usage: discord-cli ${spec.usage}`,
    ].join("\n");
  }

  const lines = [
    "discord-cli commands:",
    ...getCommandSpecs().map((cmd) => `  ${cmd.usage.padEnd(36)} ${cmd.summary}`),
    "  quit                                 exit shell mode",
  ];
  return lines.join("\n");
}

const specs: CommandSpec[] = [
  {
    name: "help",
    summary: "Show help for direct commands and shell commands",
    usage: "help [command]",
    cli: {
      arguments: ["[command]"],
      options: [JSON_OPTION],
      buildInput: (args, options) =>
        createCommandInput("help", stringArg(args[0]) ? [stringArg(args[0])!] : [], {
          json: !!options.json,
        }),
    },
    handler: async (input) => {
      const name = input.args[0];
      if (!name) return ok(renderHelp(), { command: "help", help: getCommandSpecs().map(serializeHelp) });
      const spec = getCommandSpec(name);
      if (!spec) return fail(`unknown command: ${name}`, 5, { error: "unknown command", command: name });
      return ok(renderHelp(spec), { command: "help", help: serializeHelp(spec) });
    },
  },
  {
    name: "status",
    summary: "Show current auth/session status",
    usage: "status [--json]",
    cli: {
      options: [JSON_OPTION],
      buildInput: (_args, options) => createCommandInput("status", [], { json: !!options.json }),
    },
    needsAuth: true,
    needsConnection: true,
    handler: async (_input, ctx) => {
      const active = currentDm(ctx);
      return ok(
        [
          `logged in as ${ctx.auth!.username}`,
          `${ctx.dms.length} DMs loaded`,
          active ? `current DM: ${formatDmLabel(active)} [${active.id}]` : "no active DM",
        ].join("\n"),
        {
          command: "status",
          user: ctx.auth!.username,
          connected: !!ctx.client,
          dmCount: ctx.dms.length,
          currentDm: active
            ? { id: active.id, name: active.name, isGroup: active.isGroup, memberCount: active.memberCount }
            : null,
        },
      );
    },
  },
  {
    name: "list",
    summary: "List DMs in recency order",
    usage: "list [--json]",
    cli: {
      options: [JSON_OPTION],
      buildInput: (_args, options) => createCommandInput("list", [], { json: !!options.json }),
    },
    needsAuth: true,
    needsConnection: true,
    handler: async (_input, ctx) =>
      ok(listText(ctx.dms), {
        command: "list",
        items: ctx.dms.map((dm, idx) => ({
          index: idx + 1,
          id: dm.id,
          name: dm.name,
          isGroup: dm.isGroup,
          memberCount: dm.memberCount,
          lastActivityAt: dm.lastActivityAt,
        })),
      }),
  },
  {
    name: "current",
    summary: "Show the active DM in shell mode",
    usage: "current [--json]",
    cli: {
      options: [JSON_OPTION],
      buildInput: (_args, options) => createCommandInput("current", [], { json: !!options.json }),
    },
    handler: async (_input, ctx) => {
      const dm = currentDm(ctx);
      if (!dm) return ok("no active DM", { command: "current", currentDm: null });
      return ok(`current DM: ${formatDmLabel(dm)} [${dm.id}]`, {
        command: "current",
        currentDm: { id: dm.id, name: dm.name, isGroup: dm.isGroup, memberCount: dm.memberCount },
      });
    },
  },
  {
    name: "use",
    summary: "Resolve and select a DM by name, index, or channel id",
    usage: "use <query> [--json]",
    cli: {
      arguments: ["<query...>"],
      options: [JSON_OPTION],
      buildInput: (args, options) => createCommandInput("use", stringArgs(args[0]), {
        json: !!options.json,
      }),
    },
    needsAuth: true,
    needsConnection: true,
    handler: async (input, ctx) => {
      const query = getUseQuery(input);
      if (!query) return fail("usage: discord-cli use <query>", 5, { error: "missing query" });
      const resolved = resolveDmQuery(ctx.dms, query);
      if (resolved.kind !== "match") return resolutionError(resolved);
      ctx.shellState.currentChannelId = resolved.dm.id;
      ctx.shellState.currentChannelName = resolved.dm.name;
      return ok(`using dm: ${formatDmLabel(resolved.dm)} [${resolved.dm.id}]`, {
        command: "use",
        channelId: resolved.dm.id,
        dm: {
          id: resolved.dm.id,
          name: resolved.dm.name,
          isGroup: resolved.dm.isGroup,
          memberCount: resolved.dm.memberCount,
        },
      });
    },
  },
  {
    name: "messages",
    summary: "Fetch recent messages for a DM",
    usage: "messages [limit] [--dm <query> | --channel-id <id>] [--json]",
    cli: {
      arguments: ["[limit]"],
      options: [DM_OPTION, CHANNEL_ID_OPTION, BEFORE_OPTION, JSON_OPTION],
      buildInput: (args, options) =>
        createCommandInput("messages", stringArg(args[0]) ? [stringArg(args[0])!] : [], {
          dm: stringArg(options.dm),
          "channel-id": stringArg(options.channelId),
          before: stringArg(options.before),
          json: !!options.json,
        }),
    },
    needsAuth: true,
    needsConnection: true,
    handler: async (input, ctx) => {
      const limit = parseLimit(input);
      if (typeof limit !== "number") return limit;
      const target = resolveTarget(input, ctx);
      if (!target.ok) return target.result;
      const beforeId = typeof input.flags["before"] === "string" ? input.flags["before"] : undefined;
      const messages = await loadDmMessages(ctx.client!, {
        channelId: target.target.channelId,
        limit,
        beforeId,
      });
      return ok(messages.length === 0 ? "no messages" : messages.map(formatMessage).join("\n"), {
        command: "messages",
        channelId: target.target.channelId,
        dm: target.target.dm
          ? {
              id: target.target.dm.id,
              name: target.target.dm.name,
              isGroup: target.target.dm.isGroup,
              memberCount: target.target.dm.memberCount,
            }
          : null,
        items: messages.map((message) => ({
          id: message.id,
          channelId: message.channelId,
          authorId: message.authorId,
          authorName: message.authorName,
          content: message.content,
          createdAt: message.createdAt,
          attachments: message.attachments,
        })),
      });
    },
  },
  {
    name: "send",
    summary: "Send a message to a DM",
    usage: "send <text> [--dm <query> | --channel-id <id>] [--json]",
    cli: {
      arguments: ["<text...>"],
      options: [DM_OPTION, CHANNEL_ID_OPTION, JSON_OPTION],
      buildInput: (args, options) => createCommandInput("send", stringArgs(args[0]), {
        dm: stringArg(options.dm),
        "channel-id": stringArg(options.channelId),
        json: !!options.json,
      }),
    },
    needsAuth: true,
    needsConnection: true,
    handler: async (input, ctx) => {
      const text = getSendText(input);
      if (!text) return fail("message text cannot be empty", 5, { error: "empty message" });
      const target = resolveTarget(input, ctx);
      if (!target.ok) return target.result;
      try {
        await sendDmMessage(ctx.client!, {
          channelId: target.target.channelId,
          content: text,
        });
      } catch (error) {
        return fail((error as Error).message, 6, {
          error: "send failure",
          channelId: target.target.channelId,
        });
      }
      return ok("sent", {
        command: "send",
        channelId: target.target.channelId,
        dm: target.target.dm
          ? {
              id: target.target.dm.id,
              name: target.target.dm.name,
              isGroup: target.target.dm.isGroup,
              memberCount: target.target.dm.memberCount,
            }
          : null,
        sent: true,
      });
    },
  },
  {
    name: "refresh",
    summary: "Refresh the in-memory DM list",
    usage: "refresh [--json]",
    cli: {
      options: [JSON_OPTION],
      buildInput: (_args, options) => createCommandInput("refresh", [], { json: !!options.json }),
    },
    needsAuth: true,
    needsConnection: true,
    handler: async (_input, ctx) => {
      ctx.dms = await loadDmDirectory(ctx.client!);
      const active = currentDm(ctx);
      if (!active) {
        ctx.shellState.currentChannelId = null;
        ctx.shellState.currentChannelName = null;
      }
      return ok(`refreshed ${ctx.dms.length} DMs`, {
        command: "refresh",
        dmCount: ctx.dms.length,
      });
    },
  },
];

function serializeHelp(spec: CommandSpec): Record<string, string> {
  return {
    name: spec.name,
    summary: spec.summary,
    usage: spec.usage,
  };
}

export function getCommandSpecs(): CommandSpec[] {
  return specs;
}

export function getCliCommandSpecs(): Array<CommandSpec & { cli: NonNullable<CommandSpec["cli"]> }> {
  return specs.filter((spec): spec is CommandSpec & { cli: NonNullable<CommandSpec["cli"]> } => !!spec.cli);
}

export function getCommandSpec(name: string): CommandSpec | undefined {
  return specs.find((spec) => spec.name === name);
}
