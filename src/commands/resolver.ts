import type { DM } from "../store/types.js";
import type { CommandContext } from "./context.js";
import type { CommandInput, CommandResult } from "./types.js";

export type ResolveDmResult =
  | { kind: "match"; dm: DM }
  | { kind: "none"; query: string }
  | { kind: "ambiguous"; query: string; matches: DM[] };

export interface TargetSelection {
  channelId: string;
  dm: DM | null;
}

export function resolveDmQuery(dms: DM[], query: string): ResolveDmResult {
  const trimmed = query.trim();
  if (!trimmed) return { kind: "none", query };

  const index = Number.parseInt(trimmed, 10);
  if (Number.isInteger(index) && String(index) === trimmed) {
    const byIndex = dms[index - 1];
    if (byIndex) return { kind: "match", dm: byIndex };
  }

  const byId = dms.find((dm) => dm.id === trimmed);
  if (byId) return { kind: "match", dm: byId };

  const lowered = trimmed.toLowerCase();
  const exact = dms.filter((dm) => dm.name.toLowerCase() === lowered);
  if (exact.length === 1) return { kind: "match", dm: exact[0] };
  if (exact.length > 1) return { kind: "ambiguous", query, matches: exact };

  const partial = dms.filter((dm) => dm.name.toLowerCase().includes(lowered));
  if (partial.length === 1) return { kind: "match", dm: partial[0] };
  if (partial.length > 1) return { kind: "ambiguous", query, matches: partial };

  return { kind: "none", query };
}

export function resolveTarget(input: CommandInput, ctx: CommandContext):
  | { ok: true; target: TargetSelection }
  | { ok: false; result: CommandResult } {
  const channelIdFlag = readFlagString(input.flags["channel-id"]);
  if (channelIdFlag) {
    return {
      ok: true,
      target: {
        channelId: channelIdFlag,
        dm: ctx.dms.find((dm) => dm.id === channelIdFlag) ?? null,
      },
    };
  }

  const dmFlag = readFlagString(input.flags.dm);
  if (dmFlag) {
    const resolved = resolveDmQuery(ctx.dms, dmFlag);
    if (resolved.kind === "match") {
      return { ok: true, target: { channelId: resolved.dm.id, dm: resolved.dm } };
    }
    return { ok: false, result: resolutionError(resolved) };
  }

  if (ctx.shellState.currentChannelId) {
    return {
      ok: true,
      target: {
        channelId: ctx.shellState.currentChannelId,
        dm: ctx.dms.find((dm) => dm.id === ctx.shellState.currentChannelId) ?? null,
      },
    };
  }

  return {
    ok: false,
    result: {
      ok: false,
      text: "no active DM; use --dm, --channel-id, or 'use <query>' in shell mode",
      exitCode: 5,
      data: { code: 5, error: "no active DM" },
    },
  };
}

export function formatDmLabel(dm: DM): string {
  return dm.isGroup ? `${dm.name} (${dm.memberCount})` : dm.name;
}

export function resolutionError(resolved: Exclude<ResolveDmResult, { kind: "match" }>): CommandResult {
  if (resolved.kind === "none") {
    return {
      ok: false,
      text: `DM not found: ${resolved.query}`,
      exitCode: 3,
      data: { code: 3, error: "dm not found", query: resolved.query },
    };
  }

  return {
    ok: false,
    text: [
      `ambiguous DM name "${resolved.query}":`,
      ...resolved.matches.map((dm, idx) => `${idx + 1}  ${formatDmLabel(dm)} [${dm.id}]`),
    ].join("\n"),
    exitCode: 4,
    data: {
      code: 4,
      error: "ambiguous dm name",
      query: resolved.query,
      matches: resolved.matches.map((dm) => ({
        id: dm.id,
        name: dm.name,
        isGroup: dm.isGroup,
        memberCount: dm.memberCount,
      })),
    },
  };
}

function readFlagString(value: string | boolean | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
