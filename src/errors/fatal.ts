import { logError } from "./logger.js";
import { paths } from "../config/paths.js";

export function installFatalHandlers(onExit: (code: number) => void): void {
  process.on("uncaughtException", (e) => {
    logError("uncaughtException", e);
    process.stderr.write(`\nFatal error — see ${paths.errorLog}\n`);
    onExit(1);
  });
  process.on("unhandledRejection", (e) => {
    logError("unhandledRejection", e);
    process.stderr.write(`\nFatal error — see ${paths.errorLog}\n`);
    onExit(1);
  });
}
