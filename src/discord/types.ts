export type { Attachment, Message, DM } from "../store/types.js";

export interface RawAttachment {
  id: string;
  name: string | null;
  url: string;
  contentType: string | null;
  size: number;
}

export interface RawMessage {
  id: string;
  channelId: string;
  author: {
    id: string;
    username: string;
    globalName?: string | null;
    friendNickname?: string | null;
  };
  content: string;
  createdTimestamp: number;
  attachments: { values(): Iterable<RawAttachment> } | RawAttachment[];
}

export interface RawChannel {
  id: string;
  type: string; // "DM" | "GROUP_DM"
  name: string | null;
  recipient?: {
    username: string;
    globalName?: string | null;
    friendNickname?: string | null;
  };
  recipients?: { size: number };
  lastMessageId?: string | null;
  lastMessageTimestamp?: number | null;
  createdTimestamp?: number | null;
}
