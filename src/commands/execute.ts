import { createBaseContext, type CommandContext } from "./context.js";
import { renderResult } from "./format.js";
import { getCommandSpec } from "./registry.js";
import type { CommandInput, CommandResult, OutputMode } from "./types.js";
import { createSession } from "../runtime/session.js";

function missingSessionResult(kind: "auth" | "connection"): CommandResult {
  return kind === "auth"
    ? {
        ok: false,
        text: "Not logged in. Run 'discord-cli login' first.",
        exitCode: 2,
        data: { code: 2, error: "not logged in" },
      }
    : {
        ok: false,
        text: "command requires an active Discord session",
        exitCode: 1,
        data: { code: 1, error: "missing connection" },
      };
}

export async function executeCommand(input: CommandInput, ctx: CommandContext): Promise<CommandResult> {
  const spec = getCommandSpec(input.name);
  if (!spec) {
    return {
      ok: false,
      text: `unknown command: ${input.name}`,
      exitCode: 5,
      data: { code: 5, error: "unknown command", command: input.name },
    };
  }
  if (spec.needsAuth && !ctx.auth) return missingSessionResult("auth");
  if (spec.needsConnection && !ctx.client) return missingSessionResult("connection");
  return spec.handler(input, ctx);
}

export async function runDirectCommand(input: CommandInput, opts: {
  outputMode: OutputMode;
  quiet?: boolean;
}): Promise<number> {
  const spec = getCommandSpec(input.name);
  if (!spec) {
    return writeCommandResult(
      {
        ok: false,
        text: `unknown command: ${input.name}`,
        exitCode: 5,
        data: { code: 5, error: "unknown command", command: input.name },
      },
      opts.outputMode,
    );
  }

  if (!spec.needsAuth && !spec.needsConnection) {
    const ctx = createBaseContext({ outputMode: opts.outputMode, quiet: opts.quiet, isShell: false });
    const result = await executeCommand(input, ctx);
    return writeCommandResult(result, opts.outputMode);
  }

  try {
    const session = await createSession({
      isShell: false,
      outputMode: opts.outputMode,
      quiet: opts.quiet,
    });
    try {
      const result = await executeCommand(input, session.context);
      return writeCommandResult(result, opts.outputMode);
    } finally {
      await session.close();
    }
  } catch (error) {
    return writeCommandResult(
      {
        ok: false,
        text: (error as Error).message,
        exitCode: 2,
        data: { code: 2, error: (error as Error).message },
      },
      opts.outputMode,
    );
  }
}

export function writeCommandResult(result: CommandResult, outputMode: OutputMode): number {
  const rendered = renderResult(result, outputMode);
  const target = result.ok ? process.stdout : process.stderr;
  target.write(rendered + "\n");
  return result.exitCode ?? (result.ok ? 0 : 1);
}
