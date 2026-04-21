import type { CommandResult, OutputMode } from "./types.js";

export function renderResult(result: CommandResult, outputMode: OutputMode): string {
  if (outputMode === "json") {
    return JSON.stringify({
      ok: result.ok,
      ...(result.data ?? {}),
      ...(result.exitCode ? { code: result.exitCode } : {}),
      ...(!result.ok ? { error: result.text } : {}),
    });
  }
  return result.text;
}
