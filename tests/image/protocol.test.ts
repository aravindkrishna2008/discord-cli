import { describe, it, expect } from "vitest";
import { resolveProtocol } from "../../src/image/protocol.js";

describe("resolveProtocol", () => {
  it("returns explicit choice when not auto", () => {
    expect(resolveProtocol("kitty", {})).toBe("kitty");
    expect(resolveProtocol("none", {})).toBe("none");
  });

  it("auto picks iterm for iTerm.app", () => {
    expect(resolveProtocol("auto", { TERM_PROGRAM: "iTerm.app" })).toBe("iterm");
  });

  it("auto picks kitty for kitty terminal", () => {
    expect(resolveProtocol("auto", { TERM: "xterm-kitty" })).toBe("kitty");
  });

  it("auto falls back to halfblock", () => {
    expect(resolveProtocol("auto", { TERM: "xterm-256color" })).toBe("halfblock");
  });
});
