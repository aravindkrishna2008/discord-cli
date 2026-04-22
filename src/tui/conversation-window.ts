import type { Message } from "../store/types.js";
import { estimateWrappedLineCount } from "./text.js";

export interface ConversationWindow {
  startIndex: number;
  endIndexExclusive: number;
  visibleMessages: Message[];
}

export interface VisibleImageShortcut {
  digit: string;
  attachmentId: string;
  url: string;
  name: string;
  size: number;
}

export function getConversationWindow(
  messages: Message[],
  contentWidth: number,
  maxRows: number,
  offsetFromBottom: number,
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
    const nextRows = estimateMessageRows(nextMessage, contentWidth);
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
): boolean {
  if (messages.length === 0) return true;
  return getConversationWindow(messages, contentWidth, maxRows, offsetFromBottom).startIndex === 0;
}

function estimateMessageRows(
  message: Message,
  contentWidth: number,
): number {
  const contentRows = message.content
    ? estimateWrappedLineCount(`  ${message.content}`, contentWidth)
    : 0;
  const attachmentRows = message.attachments.length;
  return 1 + contentRows + attachmentRows;
}

export function getVisibleImageShortcuts(
  messages: Message[],
  contentWidth: number,
  maxRows: number,
  offsetFromBottom: number,
): VisibleImageShortcut[] {
  const { visibleMessages } = getConversationWindow(messages, contentWidth, maxRows, offsetFromBottom);
  const shortcuts: VisibleImageShortcut[] = [];

  for (const message of visibleMessages) {
    for (const attachment of message.attachments) {
      if (!attachment.contentType?.startsWith("image/")) continue;
      const nextIndex = shortcuts.length + 1;
      if (nextIndex > 9) return shortcuts;
      shortcuts.push({
        digit: String(nextIndex),
        attachmentId: attachment.id,
        url: attachment.url,
        name: attachment.name,
        size: attachment.size,
      });
    }
  }

  return shortcuts;
}
