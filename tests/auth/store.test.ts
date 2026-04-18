import { describe, it, expect, beforeEach } from "vitest";
import { writeAuth, readAuth, clearAuth } from "../../src/auth/store.js";
import { mkdtempSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("auth store", () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "dcli-auth-"));
    file = join(dir, "auth.json");
  });

  it("read returns null when missing", () => {
    expect(readAuth(file)).toBeNull();
  });

  it("write then read round-trips", () => {
    writeAuth(file, { token: "abc", username: "alice", createdAt: 123 });
    expect(readAuth(file)).toEqual({ token: "abc", username: "alice", createdAt: 123 });
  });

  it("write sets file mode 0o600 on POSIX", () => {
    writeAuth(file, { token: "abc", username: "u", createdAt: 1 });
    if (process.platform !== "win32") {
      const mode = statSync(file).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it("clear removes the file", () => {
    writeAuth(file, { token: "abc", username: "u", createdAt: 1 });
    clearAuth(file);
    expect(existsSync(file)).toBe(false);
  });

  it("clear is idempotent", () => {
    expect(() => clearAuth(file)).not.toThrow();
  });
});
