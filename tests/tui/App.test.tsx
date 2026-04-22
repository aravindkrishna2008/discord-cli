import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { setTimeout as delay } from "node:timers/promises";
import { App } from "../../src/tui/App.js";
import { createStore } from "../../src/store/store.js";
import { initialState, type Message } from "../../src/store/types.js";
import { openImageInBrowser } from "../../src/image/open.js";

vi.mock("../../src/image/open.js", () => ({
  openImageInBrowser: vi.fn(async () => undefined),
}));

function fakeClient() {
  const calls: Array<{ kind: string; args: unknown[] }> = [];
  return {
    calls,
    client: {
      async login(token: string) {
        calls.push({ kind: "login", args: [token] });
      },
      async logout() {},
      async listDms() {
        return [];
      },
      async fetchHistory(channelId: string, beforeId?: string, limit?: number) {
        calls.push({ kind: "fetchHistory", args: [channelId, beforeId, limit] });
        return [] as Message[];
      },
      async send(channelId: string, content: string, attachments?: { path: string; name?: string }[]) {
        calls.push({ kind: "send", args: [channelId, content, attachments ?? []] });
      },
      on() {},
    },
  };
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with a preloaded store (DM list + empty conversation)", () => {
    const store = createStore({
      ...initialState,
      dms: {
        "1": {
          id: "1",
          name: "alice",
          isGroup: false,
          memberCount: 1,
          lastActivityAt: 0,
          unread: false,
        },
      },
      activeDmId: "1",
      focus: "conversation",
      connection: "connected",
    });
    const { client } = fakeClient();
    const { lastFrame } = render(<App store={store} client={client} />);
    const frame = lastFrame()!;
    expect(frame).toContain("alice");
    expect(frame).toContain("connected");
    expect(frame).toContain("no messages");
  });

  it("filters DMs and keeps the active selection on a visible match while searching", async () => {
    const store = createStore({
      ...initialState,
      dms: {
        "1": {
          id: "1",
          name: "alice",
          isGroup: false,
          memberCount: 1,
          lastActivityAt: 1,
          unread: false,
        },
        "2": {
          id: "2",
          name: "bob squad",
          isGroup: true,
          memberCount: 3,
          lastActivityAt: 2,
          unread: false,
        },
      },
      activeDmId: "1",
      connection: "connected",
    });
    const { client } = fakeClient();
    const app = render(<App store={store} client={client} />);

    app.stdin.write("/");
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.stdin.write("b");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const frame = app.lastFrame()!;
    expect(store.getState().filter).toBe("b");
    expect(store.getState().activeDmId).toBe("2");
    expect(frame).toContain("bob squad");
    expect(frame).not.toContain("alice");
  });

  it("opens the visible numbered image when a digit is pressed in conversation focus", async () => {
    const store = createStore({
      ...initialState,
      dms: {
        "1": {
          id: "1",
          name: "alice",
          isGroup: false,
          memberCount: 1,
          lastActivityAt: 1,
          unread: false,
        },
      },
      activeDmId: "1",
      focus: "conversation",
      connection: "connected",
      conversations: {
        "1": {
          messages: [
            {
              id: "m1",
              channelId: "1",
              authorId: "u1",
              authorName: "alice",
              content: "",
              createdAt: 0,
              attachments: [
                { id: "a1", name: "pic.png", url: "https://img.test/1", contentType: "image/png", size: 10 },
              ],
            },
          ],
          oldestFetchedId: "m1",
          reachedBeginning: false,
          loadingOlder: false,
          scrollOffsetFromBottom: 0,
          pendingNewCount: 0,
        },
      },
    });
    const { client } = fakeClient();
    const app = render(<App store={store} client={client} />);

    await delay(0);
    expect(app.lastFrame()).toContain("[1]");
    app.stdin.write("1");
    await delay(0);

    expect(openImageInBrowser).toHaveBeenCalledWith("https://img.test/1");
  });

  it("ignores digit presses outside conversation focus", async () => {
    const store = createStore({
      ...initialState,
      dms: {
        "1": {
          id: "1",
          name: "alice",
          isGroup: false,
          memberCount: 1,
          lastActivityAt: 1,
          unread: false,
        },
      },
      activeDmId: "1",
      focus: "list",
      connection: "connected",
      conversations: {
        "1": {
          messages: [
            {
              id: "m1",
              channelId: "1",
              authorId: "u1",
              authorName: "alice",
              content: "",
              createdAt: 0,
              attachments: [
                { id: "a1", name: "pic.png", url: "https://img.test/1", contentType: "image/png", size: 10 },
              ],
            },
          ],
          oldestFetchedId: "m1",
          reachedBeginning: false,
          loadingOlder: false,
          scrollOffsetFromBottom: 0,
          pendingNewCount: 0,
        },
      },
    });
    const { client } = fakeClient();
    const app = render(<App store={store} client={client} />);

    app.stdin.write("1");
    await delay(0);

    expect(openImageInBrowser).not.toHaveBeenCalled();
  });

  it("clears loadingOlder after a failed older-history fetch so scrolling can retry", async () => {
    const { client } = fakeClient();
    const fetchHistory = vi
      .spyOn(client, "fetchHistory")
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([]);
    const store = createStore({
      ...initialState,
      dms: {
        "1": {
          id: "1",
          name: "alice",
          isGroup: false,
          memberCount: 1,
          lastActivityAt: 1,
          unread: false,
        },
      },
      activeDmId: "1",
      focus: "conversation",
      connection: "connected",
      conversations: {
        "1": {
          messages: [
            {
              id: "m1",
              channelId: "1",
              authorId: "u1",
              authorName: "alice",
              content: "latest",
              createdAt: 0,
              attachments: [],
            },
            {
              id: "m2",
              channelId: "1",
              authorId: "u1",
              authorName: "alice",
              content: "newer",
              createdAt: 1,
              attachments: [],
            },
          ],
          oldestFetchedId: "m1",
          reachedBeginning: false,
          loadingOlder: false,
          scrollOffsetFromBottom: 1,
          pendingNewCount: 0,
        },
      },
    });
    const app = render(<App store={store} client={client} />);

    await delay(0);
    app.stdin.write("k");
    await delay(0);

    expect(fetchHistory).toHaveBeenCalledTimes(1);
    expect(store.getState().conversations["1"]?.loadingOlder).toBe(false);

    app.stdin.write("k");
    await delay(0);

    expect(fetchHistory).toHaveBeenCalledTimes(2);
    expect(store.getState().conversations["1"]?.loadingOlder).toBe(false);
  });
});
