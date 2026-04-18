import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type ImageProtocol = "auto" | "iterm" | "kitty" | "halfblock" | "none";

export interface Config {
  imageProtocol: ImageProtocol;
  initialHistory: number;
  theme: { unread: string; author: string; time: string };
}

export const defaultConfig: Config = {
  imageProtocol: "auto",
  initialHistory: 50,
  theme: { unread: "yellow", author: "cyan", time: "gray" },
};

export function loadConfig(file: string): Config {
  if (!existsSync(file)) return defaultConfig;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return {
      ...defaultConfig,
      ...raw,
      theme: { ...defaultConfig.theme, ...(raw.theme ?? {}) },
    };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(file: string, cfg: Config): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
