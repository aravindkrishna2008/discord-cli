import { Command } from "commander";
import { runDirectCommand } from "./execute.js";
import { getCliCommandSpecs } from "./registry.js";
import type { CommandCliSpec, CommandInput, OutputMode } from "./types.js";

export function registerDirectCommands(program: Command): void {
  for (const spec of getCliCommandSpecs()) {
    const command = program.command(spec.name).description(spec.summary);

    for (const argument of spec.cli.arguments ?? []) {
      command.argument(argument);
    }

    for (const option of spec.cli.options ?? []) {
      command.option(option.flags, option.description);
    }

    command.action(async () => {
      const input = buildInput(spec.cli, command);
      const exitCode = await runDirectCommand(input, {
        outputMode: getOutputMode(command),
      });
      process.exit(exitCode);
    });
  }
}

function buildInput(cli: CommandCliSpec, command: Command): CommandInput {
  return cli.buildInput(command.processedArgs, command.opts<Record<string, unknown>>());
}

function getOutputMode(command: Command): OutputMode {
  return command.opts<Record<string, unknown>>().json ? "json" : "text";
}
