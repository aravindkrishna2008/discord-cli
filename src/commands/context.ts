import type { AuthRecord } from "../auth/store.js";
import type { DiscordClient } from "../discord/client.js";
import type { DM } from "../store/types.js";
import type { OutputMode } from "./types.js";

export interface ShellState {
  currentChannelId: string | null;
  currentChannelName: string | null;
}

export interface CommandContext {
  auth: AuthRecord | null;
  client: DiscordClient | null;
  dms: DM[];
  shellState: ShellState;
  outputMode: OutputMode;
  quiet: boolean;
  isShell: boolean;
}

export function createBaseContext(opts: {
  outputMode: OutputMode;
  quiet?: boolean;
  isShell?: boolean;
}): CommandContext {
  return {
    auth: null,
    client: null,
    dms: [],
    shellState: {
      currentChannelId: null,
      currentChannelName: null,
    },
    outputMode: opts.outputMode,
    quiet: !!opts.quiet,
    isShell: !!opts.isShell,
  };
}
