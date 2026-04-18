import React from "react";
import { Box, Text } from "ink";
import type { ConversationView, Message, Attachment } from "../store/types.js";
import { placeholderFor } from "../image/render.js";
import type { ImageProtocol } from "../config/config.js";
import { ImageView } from "./ImageView.js";

interface Props {
  view: ConversationView | null;
  title: string;
  focused: boolean;
  imageProtocol: ImageProtocol;
}

export function Conversation({ view, title, focused, imageProtocol }: Props) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle={focused ? "single" : "round"}
      paddingX={1}
    >
      <Text bold>#{title}</Text>
      <Text>{"─".repeat(30)}</Text>
      {view?.loadingOlder ? <Text color="gray">… loading older messages</Text> : null}
      {!view || view.messages.length === 0 ? (
        <Text color="gray">no messages</Text>
      ) : (
        view.messages.map((m) => <MessageLine key={m.id} m={m} imageProtocol={imageProtocol} />)
      )}
      {view && view.scrollOffsetFromBottom > 0 && view.pendingNewCount > 0 ? (
        <Text color="cyan">↓ {view.pendingNewCount} new messages</Text>
      ) : null}
    </Box>
  );
}

function MessageLine({ m, imageProtocol }: { m: Message; imageProtocol: ImageProtocol }) {
  const time = new Date(m.createdAt).toISOString().slice(11, 16);
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">{m.authorName}</Text> <Text color="gray">{time}</Text>
      </Text>
      {m.content ? <Text>  {m.content}</Text> : null}
      {m.attachments.map((a) =>
        a.contentType?.startsWith("image/") ? (
          <ImageView key={a.id} a={a} protocolChoice={imageProtocol} />
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
