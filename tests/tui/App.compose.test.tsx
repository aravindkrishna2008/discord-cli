import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createStore } from "../../src/store/store.js";
import { initialState, type Message } from "../../src/store/types.js";

let latestInputProps: {
  onChange(value: string): void;
  onSubmit(): void;
  attachmentSummary?: string | null;
} | null = null;
vi.mock("../../src/tui/Input.js", () => ({
  Input: (props: {
    onChange(value: string): void;
    onSubmit(): void;
    attachmentSummary?: string | null;
  }) => {
    latestInputProps = props;
    return React.createElement(Text, null, "mock input");
  },
}));

import { App } from "../../src/tui/App.js";

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
      async send(channelId: string, content: string, attachments?: { path: string; name?: string }[]) {
        calls.push({ kind: "send", args: [channelId, content, attachments ?? []] });
      },
      on() {},
    },
  };
}

describe("App compose flow", () => {
  beforeEach(() => {
    latestInputProps = null;
    vi.clearAllMocks();
  });

  it("submits pasted image paths as attachments even before a rerender", async () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-app-"));
    const file = join(dir, "sample image.png");
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
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
      connection: "connected",
    });
    const { client, calls } = fakeClient();

    render(<App store={store} client={client} />);
    expect(latestInputProps).not.toBeNull();

    latestInputProps!.onChange(JSON.stringify(file));
    expect(latestInputProps!.attachmentSummary).toBe("[Image: sample image.png]");
    latestInputProps!.onSubmit();
    await delay(0);

    expect(calls).toContainEqual({
      kind: "send",
      args: ["1", "", [{ path: file, name: "sample image.png" }]],
    });
  });
});
