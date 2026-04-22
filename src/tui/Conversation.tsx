import React from "react";
import { Box, Text } from "ink";
import type { ConversationView, Message, Attachment } from "../store/types.js";
import { placeholderFor } from "../image/render.js";
import { truncateText } from "./text.js";
import { getConversationWindow } from "./conversation-window.js";

interface Props {
  view: ConversationView | null;
  title: string;
  focused: boolean;
  width: number;
  height: number;
  imageShortcutLabels?: ReadonlyMap<string, string>;
}

export function Conversation({ view, title, focused, width, height, imageShortcutLabels }: Props) {
  const innerWidth = Math.max(1, width - 4);
  const loadingRows = view?.loadingOlder ? 1 : 0;
  const pendingRows = view && view.scrollOffsetFromBottom > 0 && view.pendingNewCount > 0 ? 1 : 0;
  const messageRows = Math.max(0, height - 4 - loadingRows - pendingRows);
  const visibleMessages = view
    ? getConversationWindow(
        view.messages,
        innerWidth,
        messageRows,
        view.scrollOffsetFromBottom,
      ).visibleMessages
    : [];

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle={focused ? "single" : "round"}
      paddingX={1}
      overflow="hidden"
    >
      <Text bold>{truncateText(`#${title}`, innerWidth)}</Text>
      <Text>{"─".repeat(innerWidth)}</Text>
      {view?.loadingOlder ? <Text color="gray">… loading older messages</Text> : null}
      {!view || view.messages.length === 0 ? (
        <Text color="gray">no messages</Text>
      ) : (
        visibleMessages.map((m) => (
          <MessageLine
            key={m.id}
            m={m}
            contentWidth={innerWidth}
            imageShortcutLabels={imageShortcutLabels}
          />
        ))
      )}
      {view && view.scrollOffsetFromBottom > 0 && view.pendingNewCount > 0 ? (
        <Text color="cyan">{truncateText(`↓ ${view.pendingNewCount} new messages`, innerWidth)}</Text>
      ) : null}
    </Box>
  );
}

function MessageLine({
  m,
  contentWidth,
  imageShortcutLabels,
}: {
  m: Message;
  contentWidth: number;
  imageShortcutLabels?: ReadonlyMap<string, string>;
}) {
  const time = new Date(m.createdAt).toISOString().slice(11, 16);
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">{truncateText(m.authorName, Math.max(1, contentWidth - time.length - 1))}</Text>{" "}
        <Text color="gray">{time}</Text>
      </Text>
      {m.content ? <Text>  {m.content}</Text> : null}
      {m.attachments.map((a) =>
        a.contentType?.startsWith("image/") ? (
          <ImageAttachmentLine
            key={a.id}
            a={a}
            contentWidth={contentWidth}
            shortcutLabel={imageShortcutLabels?.get(a.id) ?? null}
          />
        ) : (
          <AttachmentLine key={a.id} a={a} />
        ),
      )}
    </Box>
  );
}

function AttachmentLine({ a }: { a: Attachment }) {
  return <Text color="gray">  {placeholderFor(a.name, a.size)}</Text>;
}

function ImageAttachmentLine({
  a,
  contentWidth,
  shortcutLabel,
}: {
  a: Attachment;
  contentWidth: number;
  shortcutLabel: string | null;
}) {
  const prefix = shortcutLabel ? `  ${shortcutLabel} ` : "      ";
  const body = `${a.name} · ${formatBytes(a.size)}`;
  return <Text color="cyan">{truncateText(prefix + body, contentWidth)}</Text>;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
