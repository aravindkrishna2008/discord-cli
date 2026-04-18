import { homedir } from "node:os";
import { join } from "node:path";

const root = join(homedir(), ".discord-cli");

export const paths = {
  root,
  authFile: join(root, "auth.json"),
  configFile: join(root, "config.json"),
  errorLog: join(root, "error.log"),
};
