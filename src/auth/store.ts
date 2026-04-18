import { readFileSync, writeFileSync, chmodSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname } from "node:path";

export interface AuthRecord {
  token: string;
  username: string;
  createdAt: number;
}

export function readAuth(file: string): AuthRecord | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as AuthRecord;
  } catch {
    return null;
  }
}

export function writeAuth(file: string, record: AuthRecord): void {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(record, null, 2) + "\n", { mode: 0o600 });
  if (process.platform !== "win32") chmodSync(file, 0o600);
}

export function clearAuth(file: string): void {
  if (existsSync(file)) rmSync(file);
}
