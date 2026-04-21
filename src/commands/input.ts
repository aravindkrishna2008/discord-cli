import type { CommandFlags, CommandInput } from "./types.js";

export function createCommandInput(
  name: string,
  args: string[] = [],
  flags: CommandFlags = {},
): CommandInput {
  const renderedFlags = renderFlags(flags);
  const renderedArgs = args.map(renderToken);

  return {
    name,
    args,
    flags,
    raw: [renderToken(name), ...renderedFlags, ...renderedArgs].join(" "),
    rawArgs: [...renderedFlags, ...renderedArgs].join(" "),
  };
}

function renderFlags(flags: CommandFlags): string[] {
  return Object.entries(flags).flatMap(([key, value]) => {
    if (value === undefined || value === false) return [];
    if (value === true) return [`--${key}`];
    return [`--${key}`, renderToken(value)];
  });
}

function renderToken(value: string): string {
  return /[\s"'\\]/.test(value) ? JSON.stringify(value) : value;
}
