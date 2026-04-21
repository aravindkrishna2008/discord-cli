import { describe, it, expect } from "vitest";
import { getConversationWindow } from "../../src/tui/conversation-window.js";
import type { Message } from "../../src/store/types.js";

const msg = (over: Partial<Message> & { id: string }): Message => ({
  channelId: "c",
  authorId: "u1",
  authorName: "alice",
  content: "hi",
  createdAt: Date.UTC(2026, 0, 1, 14, 22),
  attachments: [],
  ...over,
});

describe("getConversationWindow", () => {
  it("reserves multiple rows for image attachments", () => {
    const messages = [
      msg({ id: "m1", content: "older" }),
      msg({ id: "m2", content: "middle" }),
      msg({
        id: "m3",
        content: "",
        attachments: [{ id: "a1", name: "pic.png", url: "u", contentType: "image/png", size: 2048 }],
      }),
    ];

    const window = getConversationWindow(messages, 30, 10, 0, 6);

    expect(window.visibleMessages.map((message) => message.id)).toEqual(["m2", "m3"]);
  });
});
