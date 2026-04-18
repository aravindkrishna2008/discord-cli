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

import { describe as describe2, it as it2, expect as expect2, beforeEach } from "vitest";
import { loadConfig, saveConfig, defaultConfig } from "../src/config/config.js";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";

describe2("config", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(pjoin(tmpdir(), "dcli-"));
  });

  it2("returns defaults when file missing", () => {
    const cfg = loadConfig(pjoin(dir, "config.json"));
    expect2(cfg).toEqual(defaultConfig);
  });

  it2("merges partial config onto defaults", () => {
    writeFileSync(pjoin(dir, "config.json"), JSON.stringify({ imageProtocol: "kitty" }));
    const cfg = loadConfig(pjoin(dir, "config.json"));
    expect2(cfg.imageProtocol).toBe("kitty");
    expect2(cfg.initialHistory).toBe(defaultConfig.initialHistory);
  });

  it2("save writes JSON and creates directory", () => {
    const file = pjoin(dir, "nested", "config.json");
    saveConfig(file, { ...defaultConfig, initialHistory: 25 });
    expect2(existsSync(file)).toBe(true);
    const round = JSON.parse(readFileSync(file, "utf8"));
    expect2(round.initialHistory).toBe(25);
  });

  it2("returns defaults on malformed JSON (does not throw)", () => {
    writeFileSync(pjoin(dir, "config.json"), "{ not json");
    const cfg = loadConfig(pjoin(dir, "config.json"));
    expect2(cfg).toEqual(defaultConfig);
  });
});
