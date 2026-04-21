import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../src/tui/App.js";
import { createStore } from "../../src/store/store.js";
import { initialState, type Message } from "../../src/store/types.js";

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
      async fetchHistory() {
        return [] as Message[];
      },
      async send(channelId: string, content: string) {
        calls.push({ kind: "send", args: [channelId, content] });
      },
      on() {},
    },
  };
}

describe("App", () => {
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
});
