#!/usr/bin/env node
import { Command } from "commander";
import { paths } from "../src/config/paths.js";
import { readAuth, writeAuth, clearAuth } from "../src/auth/store.js";
import { loginViaBrowser, chromiumAvailable } from "../src/auth/playwright-login.js";
import { promptTokenPaste } from "../src/auth/manual-login.js";
import { installFatalHandlers } from "../src/errors/fatal.js";
import { runTui } from "../src/tui/App.js";
import { registerDirectCommands } from "../src/commands/cli.js";
import { runShell } from "../src/shell/repl.js";

installFatalHandlers((code) => process.exit(code));

const program = new Command();
program
  .name("discord-cli")
  .description("Terminal Discord client for DMs")
  .version("0.1.0")
  .helpCommand(false);

program
  .command("login")
  .description("Log in via a browser (Playwright) or manual token paste")
  .option("--manual", "Skip Playwright and paste a token manually")
  .action(async (opts) => {
    let token: string;
    let username = "unknown";
    if (!opts.manual && (await chromiumAvailable())) {
      const res = await loginViaBrowser();
      token = res.token;
      username = res.username;
    } else {
      if (!opts.manual) {
        process.stdout.write(
          "Playwright/Chromium not available. Run 'npx playwright install chromium' or use --manual.\n",
        );
      }
      token = await promptTokenPaste();
    }
    writeAuth(paths.authFile, { token, username, createdAt: Date.now() });
    process.stdout.write(`\u2714 logged in as ${username}\n`);
  });

program
  .command("logout")
  .description("Delete the stored token")
  .action(() => {
    clearAuth(paths.authFile);
    process.stdout.write("logged out\n");
  });

registerDirectCommands(program);

program
  .command("shell")
  .description("Start a line-oriented shell for compound requests")
  .option("--json", "Emit JSON output")
  .option("--quiet", "Suppress the shell banner")
  .action(async (opts) => {
    const exitCode = await runShell({
      outputMode: opts.json ? "json" : "text",
      quiet: !!opts.quiet,
    });
    process.exit(exitCode);
  });

program.action(async () => {
  const auth = readAuth(paths.authFile);
  if (!auth) {
    process.stderr.write("Not logged in. Run 'discord-cli login' first.\n");
    process.exit(1);
  }
  await runTui();
});

program.parseAsync().catch((e) => {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exit(1);
});
