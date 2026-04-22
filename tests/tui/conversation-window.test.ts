import { describe, it, expect } from "vitest";
import { getConversationWindow, getVisibleImageShortcuts } from "../../src/tui/conversation-window.js";
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
  it("counts image attachments as single rows", () => {
    const messages = [
      msg({ id: "m1", content: "older" }),
      msg({ id: "m2", content: "middle" }),
      msg({
        id: "m3",
        content: "",
        attachments: [{ id: "a1", name: "pic.png", url: "u", contentType: "image/png", size: 2048 }],
      }),
    ];

    const window = getConversationWindow(messages, 30, 6, 0);

    expect(window.visibleMessages.map((message) => message.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("counts explicit line breaks when reserving rows for message content", () => {
    const messages = [
      msg({ id: "m1", content: "one\ntwo\nthree\nfour\nfive" }),
      msg({ id: "m2", content: "latest" }),
    ];

    const window = getConversationWindow(messages, 30, 6, 0);

    expect(window.visibleMessages.map((message) => message.id)).toEqual(["m2"]);
  });
});

describe("getVisibleImageShortcuts", () => {
  it("numbers only visible image attachments in render order", () => {
    const messages = [
      msg({
        id: "m1",
        attachments: [
          { id: "a1", name: "one.png", url: "u1", contentType: "image/png", size: 100 },
          { id: "a2", name: "two.pdf", url: "u2", contentType: "application/pdf", size: 200 },
        ],
      }),
      msg({
        id: "m2",
        attachments: [
          { id: "a3", name: "three.png", url: "u3", contentType: "image/png", size: 300 },
        ],
      }),
    ];

    expect(getVisibleImageShortcuts(messages, 30, 8, 0)).toEqual([
      { digit: "1", attachmentId: "a1", url: "u1", name: "one.png", size: 100 },
      { digit: "2", attachmentId: "a3", url: "u3", name: "three.png", size: 300 },
    ]);
  });

  it("limits numbering to the first nine visible images", () => {
    const attachments = Array.from({ length: 10 }, (_, index) => ({
      id: `a${index + 1}`,
      name: `${index + 1}.png`,
      url: `u${index + 1}`,
      contentType: "image/png",
      size: index + 1,
    }));

    const shortcuts = getVisibleImageShortcuts(
      [msg({ id: "m1", content: "", attachments })],
      40,
      20,
      0,
    );

    expect(shortcuts).toHaveLength(9);
    expect(shortcuts[0]?.digit).toBe("1");
    expect(shortcuts[8]?.digit).toBe("9");
  });
});
