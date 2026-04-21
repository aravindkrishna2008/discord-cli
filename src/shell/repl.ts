import * as readline from "node:readline";
import { executeCommand, writeCommandResult } from "../commands/execute.js";
import { parseShellLine } from "../commands/parser.js";
import { createSession } from "../runtime/session.js";
import type { OutputMode } from "../commands/types.js";

export async function runShell(opts: {
  outputMode: OutputMode;
  quiet?: boolean;
}): Promise<number> {
  const session = await createSession({
    isShell: true,
    outputMode: opts.outputMode,
    quiet: opts.quiet,
  });

  try {
    if (opts.outputMode === "json") {
      process.stdout.write(JSON.stringify({
        ok: true,
        event: "ready",
        user: session.context.auth?.username ?? "unknown",
        dmCount: session.context.dms.length,
      }) + "\n");
    } else if (!opts.quiet) {
      process.stdout.write("discord-cli shell\n");
      process.stdout.write(`connected as ${session.context.auth?.username ?? "unknown"}\n`);
      process.stdout.write(`${session.context.dms.length} DMs loaded\n`);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: opts.outputMode === "json" ? "" : "dm> ",
    });

    if (opts.outputMode !== "json") rl.prompt();

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (opts.outputMode !== "json") rl.prompt();
        continue;
      }
      if (trimmed === "quit" || trimmed === "exit") {
        break;
      }

      try {
        const input = parseShellLine(trimmed);
        const result = await executeCommand(input, session.context);
        writeCommandResult(result, opts.outputMode);
      } catch (error) {
        writeCommandResult(
          {
            ok: false,
            text: (error as Error).message,
            exitCode: 5,
            data: { code: 5, error: (error as Error).message },
          },
          opts.outputMode,
        );
      }

      if (opts.outputMode !== "json") rl.prompt();
    }

    rl.close();
    return 0;
  } finally {
    await session.close();
  }
}
