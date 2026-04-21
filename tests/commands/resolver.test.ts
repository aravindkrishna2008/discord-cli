import { describe, it, expect } from "vitest";
import { resolveDmQuery, resolveTarget } from "../../src/commands/resolver.js";
import { createBaseContext } from "../../src/commands/context.js";
import type { CommandInput } from "../../src/commands/types.js";
import type { DM } from "../../src/store/types.js";

const dms: DM[] = [
  { id: "1", name: "Alice", isGroup: false, memberCount: 1, lastActivityAt: 30, unread: false },
  { id: "2", name: "Alice Smith", isGroup: false, memberCount: 1, lastActivityAt: 20, unread: false },
  { id: "3", name: "Study Group", isGroup: true, memberCount: 3, lastActivityAt: 10, unread: false },
];

describe("DM resolver", () => {
  it("resolves by list index", () => {
    expect(resolveDmQuery(dms, "1")).toEqual({ kind: "match", dm: dms[0] });
  });

  it("returns ambiguity details for multiple matches", () => {
    const result = resolveDmQuery(dms, "ali");
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.matches.map((dm) => dm.id)).toEqual(["1", "2"]);
    }
  });

  it("uses current shell DM when no explicit target is provided", () => {
    const ctx = createBaseContext({ outputMode: "json", isShell: true });
    ctx.dms = dms;
    ctx.shellState.currentChannelId = "3";
    const input: CommandInput = {
      name: "messages",
      args: [],
      flags: {},
      raw: "messages",
      rawArgs: "",
    };
    const resolved = resolveTarget(input, ctx);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.target.channelId).toBe("3");
    }
  });
});
