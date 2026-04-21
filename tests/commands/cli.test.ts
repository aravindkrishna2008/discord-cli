import { describe, expect, it } from "vitest";
import { getCliCommandSpecs, getCommandSpecs, getCommandSpec } from "../../src/commands/registry.js";

describe("command cli metadata", () => {
  it("keeps every shared command available to direct CLI mode", () => {
    expect(getCliCommandSpecs().map((spec) => spec.name)).toEqual(
      getCommandSpecs().map((spec) => spec.name),
    );
  });

  it("builds direct send input from the shared spec", () => {
    const spec = getCommandSpec("send");
    const input = spec!.cli!.buildInput([["hello", "there"]], {
      dm: "Alice",
      channelId: "123",
      json: true,
    });

    expect(input).toEqual({
      name: "send",
      args: ["hello", "there"],
      flags: {
        dm: "Alice",
        "channel-id": "123",
        json: true,
      },
      raw: "send --dm Alice --channel-id 123 --json hello there",
      rawArgs: "--dm Alice --channel-id 123 --json hello there",
    });
  });
});
