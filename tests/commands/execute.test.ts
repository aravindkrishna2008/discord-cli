import { describe, it, expect, vi } from "vitest";
import { createBaseContext } from "../../src/commands/context.js";
import { executeCommand } from "../../src/commands/execute.js";
import type { CommandInput } from "../../src/commands/types.js";
import type { DM, Message } from "../../src/store/types.js";

const dms: DM[] = [
  { id: "1", name: "Alice", isGroup: false, memberCount: 1, lastActivityAt: 30, unread: false },
  { id: "2", name: "Study Group", isGroup: true, memberCount: 3, lastActivityAt: 20, unread: false },
];

const messages: Message[] = [
  {
    id: "m1",
    channelId: "1",
    authorId: "u1",
    authorName: "Alice",
    content: "hey there",
    createdAt: Date.UTC(2026, 3, 20, 17, 13),
    attachments: [],
  },
];

function input(name: string, args: string[] = [], flags: Record<string, string | boolean | undefined> = {}): CommandInput {
  return {
    name,
    args,
    flags,
    raw: [name, ...args].join(" "),
    rawArgs: args.join(" "),
  };
}

function makeContext() {
  const ctx = createBaseContext({ outputMode: "json", isShell: true });
  const send = vi.fn();
  const fetchHistory = vi.fn();
  const listDms = vi.fn();
  ctx.auth = { token: "token", username: "me", createdAt: 1 };
  ctx.client = {
    async login() {},
    async logout() {},
    async listDms() {
      listDms();
      return dms;
    },
    async fetchHistory(channelId: string, beforeId?: string, limit?: number) {
      fetchHistory(channelId, beforeId, limit);
      return messages;
    },
    async send(channelId: string, content: string) {
      send(channelId, content);
    },
    on() {},
  };
  ctx.dms = dms;
  return { ctx, send, fetchHistory, listDms };
}

describe("command execution", () => {
  it("help works without a Discord session", async () => {
    const ctx = createBaseContext({ outputMode: "text" });
    const result = await executeCommand(input("help"), ctx);
    expect(result.ok).toBe(true);
    expect(result.text).toContain("discord-cli commands:");
  });

  it("use sets the shell current DM", async () => {
    const { ctx } = makeContext();
    const result = await executeCommand(input("use", ["Alice"]), ctx);
    expect(result.ok).toBe(true);
    expect(ctx.shellState.currentChannelId).toBe("1");
  });

  it("messages supports direct targeting and shell targeting with the same handler", async () => {
    const { ctx, fetchHistory } = makeContext();
    const direct = await executeCommand(input("messages", ["10"], { dm: "Alice" }), ctx);
    expect(direct.ok).toBe(true);
    expect(fetchHistory).toHaveBeenLastCalledWith("1", undefined, 10);

    ctx.shellState.currentChannelId = "1";
    const shell = await executeCommand(input("messages", ["10"]), ctx);
    expect(shell.ok).toBe(true);
    expect(fetchHistory).toHaveBeenLastCalledWith("1", undefined, 10);
  });

  it("send prefers explicit channel-id over the current shell DM", async () => {
    const { ctx, send } = makeContext();
    ctx.shellState.currentChannelId = "1";
    const result = await executeCommand(
      input("send", ["hello"], { "channel-id": "2" }),
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledWith("2", "hello");
  });

  it("refresh replaces the in-memory DM list", async () => {
    const { ctx, listDms } = makeContext();
    const result = await executeCommand(input("refresh"), ctx);
    expect(result.ok).toBe(true);
    expect(listDms).toHaveBeenCalledOnce();
  });
});
