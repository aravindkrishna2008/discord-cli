import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function promptTokenPaste(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    stdout.write(
      "Automated login unavailable. Paste your Discord user token below.\n" +
        "(Open Discord in a browser → DevTools → Application → IndexedDB → cookieStorage → 'token')\n" +
        "Token: ",
    );
    const token = (await rl.question("")).trim();
    if (!token) throw new Error("no token provided");
    return token;
  } finally {
    rl.close();
  }
}
