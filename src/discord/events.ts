import type { DM, Message } from "../store/types.js";
import type { RawAttachment, RawChannel, RawMessage } from "./types.js";

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
    authorName: raw.author.globalName ?? raw.author.username,
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

export function normalizeChannel(raw: RawChannel): DM {
  const isGroup = raw.type === "GROUP_DM";
  const name = isGroup
    ? raw.name ?? "(group)"
    : raw.recipient?.globalName ?? raw.recipient?.username ?? "(unknown)";
  const memberCount = isGroup ? raw.recipients?.size ?? 0 : 1;
  return {
    id: raw.id,
    name,
    isGroup,
    memberCount,
    lastActivityAt: raw.lastMessageTimestamp ?? 0,
    unread: false,
  };
}
