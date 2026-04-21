import { Client, type TextBasedChannel } from "discord.js-selfbot-v13";
import { normalizeChannel, normalizeMessage } from "./events.js";
import type { DM, Message } from "../store/types.js";
import type { RawChannel, RawMessage } from "./types.js";

export interface DiscordEvents {
  ready(me: { id: string; username: string }): void;
  dms(dms: DM[]): void;
  message(msg: Message): void;
  connectionChange(status: "connected" | "reconnecting"): void;
  error(e: Error): void;
}

export interface DiscordClient {
  login(token: string): Promise<void>;
  logout(): Promise<void>;
  listDms(): Promise<DM[]>;
  fetchHistory(channelId: string, beforeId?: string, limit?: number): Promise<Message[]>;
  send(channelId: string, content: string): Promise<void>;
  on<K extends keyof DiscordEvents>(event: K, handler: DiscordEvents[K]): void;
}

export function createDiscordClient(): DiscordClient {
  const client = new Client({ checkUpdate: false } as ConstructorParameters<typeof Client>[0]);
  const handlers: Partial<DiscordEvents> = {};

  function collectDms(): DM[] {
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
    return dmChannels;
  }

  client.on("ready", () => {
    const me = { id: client.user!.id, username: client.user!.username };
    handlers.ready?.(me);
    handlers.dms?.(collectDms());
    handlers.connectionChange?.("connected");
  });

  client.on("messageCreate", (m) => {
    const type = (m.channel as { type?: string }).type;
    if (type !== "DM" && type !== "GROUP_DM") return;
    handlers.message?.(normalizeMessage(m as unknown as RawMessage));
  });

  client.on("shardDisconnect", () => handlers.connectionChange?.("reconnecting"));
  client.on("shardResume", () => handlers.connectionChange?.("connected"));
  client.on("error", (e) => handlers.error?.(e));

  return {
    async login(token) {
      await client.login(token);
    },
    async logout() {
      await client.destroy();
    },
    async listDms() {
      return collectDms();
    },
    async fetchHistory(channelId, beforeId, limit = 50) {
      const ch = (await client.channels.fetch(channelId)) as TextBasedChannel | null;
      if (!ch || !("messages" in ch)) return [];
      const opts: { limit: number; before?: string } = { limit };
      if (beforeId) opts.before = beforeId;
      const collection = await ch.messages.fetch(opts);
      const raws = Array.from(collection.values()) as unknown as RawMessage[];
      return raws.map(normalizeMessage);
    },
    async send(channelId, content) {
      const ch = (await client.channels.fetch(channelId)) as TextBasedChannel | null;
      if (!ch || !("send" in ch)) throw new Error(`channel ${channelId} not sendable`);
      await ch.send(content);
    },
    on(event, handler) {
      handlers[event] = handler as never;
    },
  };
}
