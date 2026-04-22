import { beforeEach, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { readClipboardImagePaths, readClipboardText } from "../../src/tui/clipboard-image.js";

const execFileMock = vi.mocked(execFile);

function mockExecFile(
  impl: (...mockArgs: unknown[]) => unknown,
): typeof execFile {
  return impl as unknown as typeof execFile;
}

describe("readClipboardImagePaths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers copied file references over rasterizing the clipboard", async () => {
    execFileMock.mockImplementationOnce(mockExecFile((...mockArgs: unknown[]) => {
      const [command, args, callback] = mockArgs as [
        string,
        string[],
        (error: Error | null, stdout: string, stderr: string) => void,
      ];
      expect(command).toBe("osascript");
      expect(args.join(" ")).toContain("alias list");
      callback(null, "/tmp/copied-image.png\n", "");
      return {} as never;
    }));

    await expect(readClipboardImagePaths()).resolves.toEqual(["/tmp/copied-image.png"]);
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a temporary PNG when the clipboard only has bitmap data", async () => {
    execFileMock
      .mockImplementationOnce(mockExecFile((...mockArgs: unknown[]) => {
        const [command, args, callback] = mockArgs as [
          string,
          string[],
          (error: Error | null, stdout: string, stderr: string) => void,
        ];
        expect(command).toBe("osascript");
        expect(args.join(" ")).toContain("alias list");
        callback(null, "", "");
        return {} as never;
      }))
      .mockImplementationOnce(mockExecFile((...mockArgs: unknown[]) => {
        const [command, args, callback] = mockArgs as [
          string,
          string[],
          (error: Error | null, stdout: string, stderr: string) => void,
        ];
        expect(command).toBe("osascript");
        expect(args.join(" ")).toContain("PNGf");
        callback(null, "", "");
        return {} as never;
      }));

    const paths = await readClipboardImagePaths();

    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain("discord-cli-clipboard-");
    expect(paths[0]).toMatch(/\.png$/);
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });
});

describe("readClipboardText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads plain-text clipboard contents before any PNG coercion", async () => {
    execFileMock.mockImplementationOnce(mockExecFile((...mockArgs: unknown[]) => {
      const [command, args, callback] = mockArgs as [
        string,
        string[],
        (error: Error | null, stdout: string, stderr: string) => void,
      ];
      expect(command).toBe("pbpaste");
      expect(args).toEqual([]);
      callback(null, "file:///tmp/copied-image.png\n", "");
      return {} as never;
    }));

    await expect(readClipboardText()).resolves.toBe("file:///tmp/copied-image.png");
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });
});
