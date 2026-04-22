import { truncateText } from "./text.js";

export function toFixedHeightBlock(text: string, height: number): string {
  const normalizedHeight = Math.max(1, height);
  const lines = text
    .replace(/\n+$/g, "")
    .split("\n")
    .slice(0, normalizedHeight);

  while (lines.length < normalizedHeight) lines.push("");

  return lines.join("\n");
}

export function toFixedHeightPlainTextBlock(text: string, width: number, height: number): string {
  return toFixedHeightBlock(truncateText(text, Math.max(1, width)), height);
}
