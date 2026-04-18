import { describe, it, expect } from "vitest";
import { paths } from "../src/config/paths.js";
import { homedir } from "node:os";
import { join } from "node:path";

describe("paths", () => {
  it("puts everything under ~/.discord-cli", () => {
    const root = join(homedir(), ".discord-cli");
    expect(paths.root).toBe(root);
    expect(paths.authFile).toBe(join(root, "auth.json"));
    expect(paths.configFile).toBe(join(root, "config.json"));
    expect(paths.errorLog).toBe(join(root, "error.log"));
  });
});
