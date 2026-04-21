import { describe, it, expect } from "vitest";
import { parseShellLine, tokenizeShellLine } from "../../src/commands/parser.js";

describe("command parser", () => {
  it("tokenizes quoted strings", () => {
    expect(tokenizeShellLine("use \"Alice Smith\"")).toEqual(["use", "Alice Smith"]);
  });

  it("parses flags and args from a shell line", () => {
    expect(parseShellLine("messages --dm \"Alice Smith\" 10")).toEqual({
      name: "messages",
      args: ["10"],
      flags: { dm: "Alice Smith" },
      raw: "messages --dm \"Alice Smith\" 10",
      rawArgs: "--dm \"Alice Smith\" 10",
    });
  });

  it("treats bare flags as booleans", () => {
    expect(parseShellLine("status --json")).toEqual({
      name: "status",
      args: [],
      flags: { json: true },
      raw: "status --json",
      rawArgs: "--json",
    });
  });
});
