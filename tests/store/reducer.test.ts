import { describe, it, expect } from "vitest";
import { reduce } from "../../src/store/reducer.js";
import { initialState, type DM, type Message } from "../../src/store/types.js";

const dm = (over: Partial<DM> = {}): DM => ({
  id: "1",
  name: "alice",
  isGroup: false,
  memberCount: 1,
  lastActivityAt: 0,
  unread: false,
  ...over,
});

describe("reducer — connection/dms/active", () => {
  it("sets connection status", () => {
    const s = reduce(initialState, { type: "connection/set", status: "connected" });
    expect(s.connection).toBe("connected");
  });

  it("upserts DMs by id (preserves existing unread)", () => {
    let s = reduce(initialState, { type: "dms/upsertMany", dms: [dm({ id: "1" })] });
    s = reduce(s, { type: "dms/markUnread", dmId: "1" });
    s = reduce(s, { type: "dms/upsertMany", dms: [dm({ id: "1", name: "alice-renamed" })] });
    expect(s.dms["1"].name).toBe("alice-renamed");
    expect(s.dms["1"].unread).toBe(true);
  });

  it("active/set clears unread on the newly active DM", () => {
    let s = reduce(initialState, { type: "dms/upsertMany", dms: [dm({ id: "1" })] });
    s = reduce(s, { type: "dms/markUnread", dmId: "1" });
    s = reduce(s, { type: "active/set", dmId: "1" });
    expect(s.activeDmId).toBe("1");
    expect(s.dms["1"].unread).toBe(false);
  });

  it("markUnread no-ops when DM is the active one", () => {
    let s = reduce(initialState, { type: "dms/upsertMany", dms: [dm({ id: "1" })] });
    s = reduce(s, { type: "active/set", dmId: "1" });
    s = reduce(s, { type: "dms/markUnread", dmId: "1" });
    expect(s.dms["1"].unread).toBe(false);
  });

  it("focus/set and filter/set update scalars", () => {
    let s = reduce(initialState, { type: "focus/set", focus: "conversation" });
    expect(s.focus).toBe("conversation");
    s = reduce(s, { type: "filter/set", value: "al" });
    expect(s.filter).toBe("al");
  });
});

const msg = (over: Partial<Message> & { id: string }): Message => ({
  channelId: "1",
  authorId: "u",
  authorName: "alice",
  content: "hi",
  createdAt: 0,
  attachments: [],
  ...over,
});

describe("reducer — messages", () => {
  it("appendLive creates a conversation if none exists", () => {
    const s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    expect(s.conversations["1"].messages).toHaveLength(1);
    expect(s.conversations["1"].messages[0].id).toBe("m1");
  });

  it("appendLive dedupes by id", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    s = reduce(s, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    expect(s.conversations["1"].messages).toHaveLength(1);
  });

  it("appendLive increments pendingNewCount when scrolled up", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    s = reduce(s, { type: "scroll/set", channelId: "1", offsetFromBottom: 10 });
    s = reduce(s, { type: "messages/appendLive", message: msg({ id: "m2" }) });
    expect(s.conversations["1"].pendingNewCount).toBe(1);
  });

  it("appendLive leaves pendingNewCount at 0 when at bottom", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    s = reduce(s, { type: "messages/appendLive", message: msg({ id: "m2" }) });
    expect(s.conversations["1"].pendingNewCount).toBe(0);
  });

  it("prependHistory adds older messages and updates oldestFetchedId", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m5" }) });
    s = reduce(s, {
      type: "messages/prependHistory",
      channelId: "1",
      messages: [msg({ id: "m1" }), msg({ id: "m2" })],
      reachedBeginning: false,
    });
    expect(s.conversations["1"].messages.map((m) => m.id)).toEqual(["m1", "m2", "m5"]);
    expect(s.conversations["1"].oldestFetchedId).toBe("m1");
    expect(s.conversations["1"].reachedBeginning).toBe(false);
  });

  it("prependHistory marks reachedBeginning when fewer than requested return", () => {
    const s = reduce(initialState, {
      type: "messages/prependHistory",
      channelId: "1",
      messages: [msg({ id: "m1" })],
      reachedBeginning: true,
    });
    expect(s.conversations["1"].reachedBeginning).toBe(true);
  });

  it("appendHistory seeds a conversation from initial fetch", () => {
    const s = reduce(initialState, {
      type: "messages/appendHistory",
      channelId: "1",
      messages: [msg({ id: "m1" }), msg({ id: "m2" })],
    });
    expect(s.conversations["1"].messages).toHaveLength(2);
    expect(s.conversations["1"].oldestFetchedId).toBe("m1");
  });

  it("scroll/consumePending resets counter", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    s = reduce(s, { type: "scroll/set", channelId: "1", offsetFromBottom: 5 });
    s = reduce(s, { type: "messages/appendLive", message: msg({ id: "m2" }) });
    s = reduce(s, { type: "scroll/consumePending", channelId: "1" });
    expect(s.conversations["1"].pendingNewCount).toBe(0);
  });

  it("setLoadingOlder toggles the flag", () => {
    let s = reduce(initialState, { type: "messages/setLoadingOlder", channelId: "1", loading: true });
    expect(s.conversations["1"].loadingOlder).toBe(true);
    s = reduce(s, { type: "messages/setLoadingOlder", channelId: "1", loading: false });
    expect(s.conversations["1"].loadingOlder).toBe(false);
  });
});
