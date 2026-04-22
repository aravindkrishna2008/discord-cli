import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import terminalImage from "terminal-image";
import { renderImageFromUrl } from "../../src/image/render.js";

vi.mock("terminal-image", () => ({
  default: {
    buffer: vi.fn(async () =>
      JSON.stringify({
        termProgram: process.env.TERM_PROGRAM ?? null,
        termProgramVersion: process.env.TERM_PROGRAM_VERSION ?? null,
        konsoleVersion: process.env.KONSOLE_VERSION ?? null,
      })),
  },
}));

const originalInlineEnv = {
  TERM_PROGRAM: process.env.TERM_PROGRAM,
  TERM_PROGRAM_VERSION: process.env.TERM_PROGRAM_VERSION,
  KONSOLE_VERSION: process.env.KONSOLE_VERSION,
};

describe("renderImageFromUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TERM_PROGRAM = "iTerm.app";
    process.env.TERM_PROGRAM_VERSION = "3.5.0";
    process.env.KONSOLE_VERSION = "240400";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreInlineEnv();
  });

  it("forces halfblock rendering by masking inline-image terminal env", async () => {
    const rendered = await renderImageFromUrl("https://example.test/image.png", {
      protocol: "halfblock",
      maxWidth: 10,
      maxHeight: 4,
    });

    expect(rendered).toBe(
      JSON.stringify({
        termProgram: null,
        termProgramVersion: null,
        konsoleVersion: null,
      }),
    );
    expect(process.env.TERM_PROGRAM).toBe("iTerm.app");
    expect(process.env.TERM_PROGRAM_VERSION).toBe("3.5.0");
    expect(process.env.KONSOLE_VERSION).toBe("240400");
  });

  it("preserves inline-image env when using an inline-capable protocol", async () => {
    const rendered = await renderImageFromUrl("https://example.test/image.png", {
      protocol: "iterm",
      maxWidth: 10,
      maxHeight: 4,
    });

    expect(rendered).toBe(
      JSON.stringify({
        termProgram: "iTerm.app",
        termProgramVersion: "3.5.0",
        konsoleVersion: "240400",
      }),
    );
    expect(vi.mocked(terminalImage.buffer)).toHaveBeenCalledTimes(1);
  });
});

function restoreInlineEnv() {
  for (const [key, value] of Object.entries(originalInlineEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
