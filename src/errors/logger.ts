import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { paths } from "../config/paths.js";

export function logError(prefix: string, err: unknown): void {
  try {
    mkdirSync(dirname(paths.errorLog), { recursive: true, mode: 0o700 });
    const line = `[${new Date().toISOString()}] ${prefix}: ${format(err)}\n`;
    appendFileSync(paths.errorLog, line, "utf8");
  } catch {
    // swallow — last line of defense
  }
}

function format(err: unknown): string {
  if (err instanceof Error) return `${err.message}\n${err.stack ?? ""}`;
  return JSON.stringify(err);
}
