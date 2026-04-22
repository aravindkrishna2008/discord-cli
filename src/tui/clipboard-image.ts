import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export async function readClipboardText(): Promise<string> {
  if (process.platform !== "darwin") {
    throw new Error("clipboard image paste is currently supported on macOS only");
  }

  return execFileText("pbpaste", []);
}

export async function readClipboardImagePaths(): Promise<string[]> {
  if (process.platform !== "darwin") {
    throw new Error("clipboard image paste is currently supported on macOS only");
  }

  const filePaths = await readClipboardFilePaths();
  if (filePaths.length > 0) return filePaths;

  const outPath = join(tmpdir(), `discord-cli-clipboard-${randomUUID()}.png`);
  await execFileAsync("osascript", appleScriptArgs(outPath));
  return [outPath];
}

function appleScriptArgs(outPath: string): string[] {
  return [
    "-e",
    "set pngData to the clipboard as «class PNGf»",
    "-e",
    `set outputFile to POSIX file ${JSON.stringify(outPath)}`,
    "-e",
    "set fileRef to open for access outputFile with write permission",
    "-e",
    "try",
    "-e",
    "  set eof of fileRef to 0",
    "-e",
    "  write pngData to fileRef",
    "-e",
    "  close access fileRef",
    "-e",
    "on error errMsg number errNum",
    "-e",
    "  try",
    "-e",
    "    close access fileRef",
    "-e",
    "  end try",
    "-e",
    "  error errMsg number errNum",
    "-e",
    "end try",
  ];
}

function clipboardFileArgs(): string[] {
  return [
    "-e",
    "try",
    "-e",
    "  set clipboardAliases to the clipboard as alias list",
    "-e",
    "on error",
    "-e",
    "  try",
    "-e",
    "    set clipboardAliases to {(the clipboard as alias)}",
    "-e",
    "  on error",
    "-e",
    "    return \"\"",
    "-e",
    "  end try",
    "-e",
    "end try",
    "-e",
    "set AppleScript's text item delimiters to linefeed",
    "-e",
    "set posixPaths to {}",
    "-e",
    "repeat with fileAlias in clipboardAliases",
    "-e",
    "  set end of posixPaths to POSIX path of fileAlias",
    "-e",
    "end repeat",
    "-e",
    "return posixPaths as text",
  ];
}

async function readClipboardFilePaths(): Promise<string[]> {
  const output = await execFileText("osascript", clipboardFileArgs());
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function execFileAsync(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }

      const details = `${stdout}\n${stderr}\n${error.message}`.trim();
      if (details.includes("Can’t make the clipboard into type «class PNGf»")) {
        reject(new Error("clipboard does not contain an image"));
        return;
      }

      reject(new Error(`failed to read clipboard image: ${details}`));
    });
  });
}

function execFileText(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (!error) {
        resolve(stdout.trim());
        return;
      }

      const details = `${stdout}\n${stderr}\n${error.message}`.trim();
      reject(new Error(`failed to inspect clipboard contents: ${details}`));
    });
  });
}
