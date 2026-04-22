import { describe, it, expect } from "vitest";
import { normalizeMessage, normalizeChannel } from "../../src/discord/events.js";

describe("normalizeMessage", () => {
  it("maps raw selfbot message to store Message (array attachments)", () => {
    const out = normalizeMessage({
      id: "m1",
      channelId: "c1",
      author: { id: "u1", username: "alice", globalName: "Alice" },
      content: "hi",
      createdTimestamp: 1000,
      attachments: [
        { id: "a1", name: "pic.png", url: "https://x", contentType: "image/png", size: 10 },
      ],
    });
    expect(out).toEqual({
      id: "m1",
      channelId: "c1",
      authorId: "u1",
      authorName: "Alice",
      content: "hi",
      createdAt: 1000,
      attachments: [
        { id: "a1", name: "pic.png", url: "https://x", contentType: "image/png", size: 10 },
      ],
    });
  });

  it("prefers a friend nickname over global name and username", () => {
    const out = normalizeMessage({
      id: "m1",
      channelId: "c1",
      author: { id: "u1", username: "alice", globalName: "Alice", friendNickname: "Bestie" },
      content: "hi",
      createdTimestamp: 1,
      attachments: [],
    });
    expect(out.authorName).toBe("Bestie");
  });

  it("falls back to username when globalName is missing", () => {
    const out = normalizeMessage({
      id: "m1",
      channelId: "c1",
      author: { id: "u1", username: "alice" },
      content: "hi",
      createdTimestamp: 1,
      attachments: [],
    });
    expect(out.authorName).toBe("alice");
  });

  it("names unnamed attachments 'file'", () => {
    const out = normalizeMessage({
      id: "m1",
      channelId: "c1",
      author: { id: "u1", username: "alice" },
      content: "",
      createdTimestamp: 1,
      attachments: [{ id: "a1", name: null, url: "u", contentType: null, size: 0 }],
    });
    expect(out.attachments[0].name).toBe("file");
  });
});

describe("normalizeChannel", () => {
  it("prefers a friend nickname for a 1:1 DM", () => {
    const dm = normalizeChannel({
      id: "c1",
      type: "DM",
      name: null,
      recipient: { username: "bob", globalName: "Bob", friendNickname: "Bobby" },
      lastMessageTimestamp: 42,
    });
    expect(dm.name).toBe("Bobby");
  });

  it("names a 1:1 DM after the other recipient", () => {
    const dm = normalizeChannel({
      id: "c1",
      type: "DM",
      name: null,
      recipient: { username: "bob", globalName: "Bob" },
      lastMessageTimestamp: 42,
    });
    expect(dm).toEqual({
      id: "c1",
      name: "Bob",
      isGroup: false,
      memberCount: 1,
      lastActivityAt: 42,
      unread: false,
    });
  });

  it("derives last activity from lastMessageId when the client omits lastMessageTimestamp", () => {
    const dm = normalizeChannel({
      id: "c1",
      type: "DM",
      name: null,
      recipient: { username: "bob", globalName: "Bob" },
      lastMessageId: "175928847299117063",
    });
    expect(dm.lastActivityAt).toBe(1462015105796);
  });

  it("uses the group's own name (or '(group)' if null) and member count", () => {
    const dm = normalizeChannel({
      id: "c2",
      type: "GROUP_DM",
      name: "study-group",
      recipients: { size: 3 },
    });
    expect(dm.isGroup).toBe(true);
    expect(dm.name).toBe("study-group");
    expect(dm.memberCount).toBe(3);
  });

  it("falls back to '(group)' when group has no name", () => {
    const dm = normalizeChannel({
      id: "c3",
      type: "GROUP_DM",
      name: null,
      recipients: { size: 4 },
    });
    expect(dm.name).toBe("(group)");
  });

  it("falls back to channel creation time when there are no messages yet", () => {
    const dm = normalizeChannel({
      id: "c4",
      type: "GROUP_DM",
      name: "new group",
      recipients: { size: 2 },
      createdTimestamp: 1234,
    });
    expect(dm.lastActivityAt).toBe(1234);
  });
});
