import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Conversation } from "../../src/tui/Conversation.js";
import type { ConversationView, Message } from "../../src/store/types.js";

const msg = (over: Partial<Message> & { id: string }): Message => ({
  channelId: "c",
  authorId: "u1",
  authorName: "alice",
  content: "hi",
  createdAt: Date.UTC(2026, 0, 1, 14, 22),
  attachments: [],
  ...over,
});

const view = (messages: Message[], extra: Partial<ConversationView> = {}): ConversationView => ({
  messages,
  oldestFetchedId: messages[0]?.id ?? null,
  reachedBeginning: false,
  loadingOlder: false,
  scrollOffsetFromBottom: 0,
  pendingNewCount: 0,
  ...extra,
});

describe("Conversation", () => {
  it("renders empty-state text", () => {
    const { lastFrame } = render(<Conversation view={null} title="alice" focused />);
    expect(lastFrame()).toContain("no messages");
  });

  it("renders author, time, and content", () => {
    const { lastFrame } = render(
      <Conversation view={view([msg({ id: "m1", content: "hey" })])} title="alice" focused />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("alice");
    expect(frame).toContain("14:22");
    expect(frame).toContain("hey");
  });

  it("renders image attachment placeholder", () => {
    const m = msg({
      id: "m1",
      attachments: [
        { id: "a", name: "pic.png", url: "u", contentType: "image/png", size: 2048 },
      ],
    });
    const { lastFrame } = render(<Conversation view={view([m])} title="alice" focused />);
    expect(lastFrame()).toContain("[image: pic.png");
  });

  it("shows 'loading older messages' indicator when fetching", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([msg({ id: "m1" })], { loadingOlder: true })}
        title="alice"
        focused
      />,
    );
    expect(lastFrame()).toContain("loading older messages");
  });

  it("shows 'N new messages' jump indicator when scrolled up with pending", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([msg({ id: "m1" })], { scrollOffsetFromBottom: 5, pendingNewCount: 2 })}
        title="alice"
        focused
      />,
    );
    expect(lastFrame()).toContain("2 new messages");
  });
});
