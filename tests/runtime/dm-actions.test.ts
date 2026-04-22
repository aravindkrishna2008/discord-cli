import { describe, expect, it, vi } from "vitest";
import { sendDmMessage } from "../../src/runtime/dm-actions.js";

describe("sendDmMessage", () => {
  it("forwards attachments to the shared Discord client", async () => {
    const send = vi.fn(async () => {});
    await sendDmMessage(
      {
        login: async () => {},
        logout: async () => {},
        listDms: async () => [],
        fetchHistory: async () => [],
        send,
        on: () => {},
      },
      {
        channelId: "123",
        content: "caption",
        attachments: [{ path: "/tmp/photo.png" }],
      },
    );

    expect(send).toHaveBeenCalledWith("123", "caption", [{ path: "/tmp/photo.png" }]);
  });
});
