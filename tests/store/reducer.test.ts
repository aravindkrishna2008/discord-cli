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
