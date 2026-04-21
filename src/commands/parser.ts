import type { CommandInput } from "./types.js";

export function tokenizeShellLine(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const ch of line) {
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === "'" || ch === "\"") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }

  if (quote) throw new Error("unterminated quote");
  if (escaping) current += "\\";
  if (current) tokens.push(current);
  return tokens;
}

export function parseShellLine(line: string): CommandInput {
  const trimmed = line.trim();
  const tokens = tokenizeShellLine(trimmed);
  const name = tokens.shift() ?? "";
  const args: string[] = [];
  const flags: Record<string, string | boolean | undefined> = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("--")) {
      args.push(token);
      continue;
    }

    const withoutPrefix = token.slice(2);
    const eq = withoutPrefix.indexOf("=");
    if (eq >= 0) {
      const key = withoutPrefix.slice(0, eq);
      const value = withoutPrefix.slice(eq + 1);
      flags[key] = value === "" ? true : value;
      continue;
    }

    const next = tokens[i + 1];
    if (next && !next.startsWith("--")) {
      flags[withoutPrefix] = next;
      i += 1;
      continue;
    }

    flags[withoutPrefix] = true;
  }

  return {
    name,
    args,
    flags,
    raw: trimmed,
    rawArgs: name ? trimmed.slice(name.length).trim() : "",
  };
}
