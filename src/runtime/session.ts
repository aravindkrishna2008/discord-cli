import { readAuth } from "../auth/store.js";
import { paths } from "../config/paths.js";
import { createDiscordClient, type DiscordClient } from "../discord/client.js";
import { logError } from "../errors/logger.js";
import { createBaseContext, type CommandContext } from "../commands/context.js";
import type { DM } from "../store/types.js";
import type { OutputMode } from "../commands/types.js";

export async function createSession(opts: {
  isShell: boolean;
  outputMode: OutputMode;
  quiet?: boolean;
  authFile?: string;
  clientFactory?: () => DiscordClient;
}): Promise<{
  context: CommandContext;
  close(): Promise<void>;
}> {
  const auth = readAuth(opts.authFile ?? paths.authFile);
  if (!auth) throw new Error("Not logged in. Run 'discord-cli login' first.");

  const client = (opts.clientFactory ?? createDiscordClient)();
  client.on("error", (error) => logError("discord.client", error));
  const dms = await loginAndLoadDms(client, auth.token);
  const context = createBaseContext({
    outputMode: opts.outputMode,
    quiet: opts.quiet,
    isShell: opts.isShell,
  });
  context.auth = auth;
  context.client = client;
  context.dms = dms;

  return {
    context,
    async close() {
      await client.logout();
    },
  };
}

async function loginAndLoadDms(client: DiscordClient, token: string): Promise<DM[]> {
  const dms = new Promise<DM[]>((resolve) => {
    client.on("dms", resolve);
  });
  await client.login(token);
  return dms;
}
