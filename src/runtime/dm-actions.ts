import type { DiscordClient } from "../discord/client.js";
import type { DM, Message } from "../store/types.js";

export const HISTORY_PAGE_SIZE = 50;

export interface OutgoingAttachment {
  path: string;
  name?: string;
}

export async function loadDmDirectory(client: DiscordClient): Promise<DM[]> {
  return client.listDms();
}

export async function loadDmMessages(
  client: DiscordClient,
  opts: { channelId: string; beforeId?: string; limit?: number },
): Promise<Message[]> {
  return client.fetchHistory(opts.channelId, opts.beforeId, opts.limit ?? HISTORY_PAGE_SIZE);
}

export async function sendDmMessage(
  client: DiscordClient,
  opts: { channelId: string; content: string; attachments?: OutgoingAttachment[] },
): Promise<void> {
  await client.send(opts.channelId, opts.content, opts.attachments ?? []);
}
