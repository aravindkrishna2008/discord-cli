import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function openImageInBrowser(url: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("open", [url]);
    return;
  }
  if (process.platform === "linux") {
    await execFileAsync("xdg-open", [url]);
    return;
  }
  throw new Error("opening images in a browser is not supported on this platform");
}
