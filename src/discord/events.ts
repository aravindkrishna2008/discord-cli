import type { DM, Message } from "../store/types.js";
import type { RawAttachment, RawChannel, RawMessage } from "./types.js";

function displayUserName(user: {
  username: string;
  globalName?: string | null;
  friendNickname?: string | null;
}): string {
  return user.friendNickname ?? user.globalName ?? user.username;
}

function attachmentsArray(
  a: RawMessage["attachments"],
): RawAttachment[] {
  if (Array.isArray(a)) return a;
  return Array.from(a.values());
}

export function normalizeMessage(raw: RawMessage): Message {
  return {
    id: raw.id,
    channelId: raw.channelId,
    authorId: raw.author.id,
    authorName: displayUserName(raw.author),
    content: raw.content,
    createdAt: raw.createdTimestamp,
    attachments: attachmentsArray(raw.attachments).map((a) => ({
      id: a.id,
      name: a.name ?? "file",
      url: a.url,
      contentType: a.contentType,
      size: a.size,
    })),
  };
}

const DISCORD_EPOCH = 1420070400000n;

function timestampFromSnowflake(id: string): number | null {
  try {
    return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
  } catch {
    return null;
  }
}

function getChannelLastActivity(raw: RawChannel): number {
  if (typeof raw.lastMessageTimestamp === "number") return raw.lastMessageTimestamp;
  if (typeof raw.lastMessageId === "string") return timestampFromSnowflake(raw.lastMessageId) ?? 0;
  if (typeof raw.createdTimestamp === "number") return raw.createdTimestamp;
  return 0;
}

export function normalizeChannel(raw: RawChannel): DM {
  const isGroup = raw.type === "GROUP_DM";
  const name = isGroup
    ? raw.name ?? "(group)"
    : raw.recipient ? displayUserName(raw.recipient) : "(unknown)";
  const memberCount = isGroup ? raw.recipients?.size ?? 0 : 1;
  return {
    id: raw.id,
    name,
    isGroup,
    memberCount,
    lastActivityAt: getChannelLastActivity(raw),
    unread: false,
  };
}
