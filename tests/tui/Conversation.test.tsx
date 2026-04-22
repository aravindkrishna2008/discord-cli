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
    const { lastFrame } = render(
      <Conversation view={null} title="alice" focused width={40} height={10} />,
    );
    expect(lastFrame()).toContain("no messages");
  });

  it("renders author, time, and content", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([msg({ id: "m1", content: "hey" })])}
        title="alice"
        focused
        width={40}
        height={10}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("alice");
    expect(frame).toContain("06:22");
    expect(frame).toContain("hey");
  });

  it("renders numbered image attachment rows", () => {
    const m = msg({
      id: "m1",
      attachments: [
        { id: "a", name: "pic.png", url: "u", contentType: "image/png", size: 2048 },
      ],
    });
    const { lastFrame } = render(
      <Conversation
        view={view([m])}
        title="alice"
        focused
        width={40}
        height={10}
        imageShortcutLabels={new Map([["a", "[1]"]])}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("[1]");
    expect(frame).toContain("pic.png");
  });

  it("renders unnumbered image rows when no shortcut is assigned", () => {
    const m = msg({
      id: "m1",
      attachments: [
        { id: "a", name: "pic.png", url: "u", contentType: "image/png", size: 2048 },
      ],
    });
    const { lastFrame } = render(
      <Conversation view={view([m])} title="alice" focused width={40} height={10} />,
    );
    expect(lastFrame()).toContain("pic.png");
    expect(lastFrame()).not.toContain("[1]");
  });

  it("shows 'loading older messages' indicator when fetching", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([msg({ id: "m1" })], { loadingOlder: true })}
        title="alice"
        focused
        width={40}
        height={10}
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
        width={40}
        height={10}
      />,
    );
    expect(lastFrame()).toContain("2 new messages");
  });

  it("shows the most recent messages when the pane height is limited", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([
          msg({ id: "m1", content: "first" }),
          msg({ id: "m2", content: "second" }),
          msg({ id: "m3", content: "third" }),
        ])}
        title="alice"
        focused
        width={40}
        height={8}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("second");
    expect(frame).toContain("third");
    expect(frame).not.toContain("first");
  });

  it("shows older messages when scrolled up", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([
          msg({ id: "m1", content: "first" }),
          msg({ id: "m2", content: "second" }),
          msg({ id: "m3", content: "third" }),
        ], { scrollOffsetFromBottom: 1 })}
        title="alice"
        focused
        width={40}
        height={8}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("first");
    expect(frame).toContain("second");
    expect(frame).not.toContain("third");
  });

  it("does not render older messages when the latest multiline message fills the viewport", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([
          msg({ id: "m1", authorName: "alice", content: "older" }),
          msg({ id: "m2", authorName: "bob", content: "one\ntwo\nthree\nfour\nfive" }),
        ])}
        title="alice"
        focused
        width={40}
        height={10}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("bob");
    expect(frame).toContain("one");
    expect(frame).toContain("five");
    expect(frame).not.toContain("alice 06:22");
    expect(frame).not.toContain("older");
  });
});
