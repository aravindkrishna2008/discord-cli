import type { Message } from "../store/types.js";
import { estimateWrappedLineCount } from "./text.js";

export interface ConversationWindow {
  startIndex: number;
  endIndexExclusive: number;
  visibleMessages: Message[];
}

export function getConversationWindow(
  messages: Message[],
  contentWidth: number,
  maxRows: number,
  offsetFromBottom: number,
  imagePreviewHeight: number,
): ConversationWindow {
  if (messages.length === 0 || maxRows <= 0) {
    return {
      startIndex: messages.length,
      endIndexExclusive: messages.length,
      visibleMessages: [],
    };
  }

  const boundedOffset = Math.max(0, Math.min(offsetFromBottom, messages.length - 1));
  const endIndexExclusive = Math.max(1, messages.length - boundedOffset);
  let startIndex = endIndexExclusive;
  let usedRows = 0;

  while (startIndex > 0) {
    const nextMessage = messages[startIndex - 1];
    const nextRows = estimateMessageRows(nextMessage, contentWidth, imagePreviewHeight);
    if (startIndex < endIndexExclusive && usedRows + nextRows > maxRows) break;
    startIndex -= 1;
    usedRows += nextRows;
    if (usedRows >= maxRows) break;
  }

  return {
    startIndex,
    endIndexExclusive,
    visibleMessages: messages.slice(startIndex, endIndexExclusive),
  };
}

export function isAtTopOfLoadedMessages(
  messages: Message[],
  contentWidth: number,
  maxRows: number,
  offsetFromBottom: number,
  imagePreviewHeight: number,
): boolean {
  if (messages.length === 0) return true;
  return getConversationWindow(
    messages,
    contentWidth,
    maxRows,
    offsetFromBottom,
    imagePreviewHeight,
  ).startIndex === 0;
}

function estimateMessageRows(
  message: Message,
  contentWidth: number,
  imagePreviewHeight: number,
): number {
  const contentRows = message.content
    ? estimateWrappedLineCount(`  ${message.content}`, contentWidth)
    : 0;
  const attachmentRows = message.attachments.reduce(
    (rows, attachment) =>
      rows + (attachment.contentType?.startsWith("image/") ? imagePreviewHeight : 1),
    0,
  );
  return 1 + contentRows + attachmentRows;
}
