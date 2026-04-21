export type OutputMode = "text" | "json";
export type CommandFlagValue = string | boolean | undefined;
export type CommandFlags = Record<string, CommandFlagValue>;

export interface CommandInput {
  name: string;
  args: string[];
  flags: CommandFlags;
  raw: string;
  rawArgs: string;
}

export interface CommandResult {
  ok: boolean;
  text: string;
  data?: Record<string, unknown>;
  exitCode?: number;
}

export interface CommandCliOptionSpec {
  flags: string;
  description: string;
}

export interface CommandCliSpec {
  arguments?: string[];
  options?: CommandCliOptionSpec[];
  buildInput: (args: unknown[], options: Record<string, unknown>) => CommandInput;
}

export interface CommandSpec {
  name: string;
  summary: string;
  usage: string;
  cli?: CommandCliSpec;
  needsAuth?: boolean;
  needsConnection?: boolean;
  handler: (input: CommandInput, ctx: import("./context.js").CommandContext) => Promise<CommandResult>;
}
