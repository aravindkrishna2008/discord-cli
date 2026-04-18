export function truncateText(text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  const chars = Array.from(text);
  if (chars.length <= maxWidth) return text;
  if (maxWidth === 1) return "…";
  return `${chars.slice(0, maxWidth - 1).join("")}…`;
}

export function estimateWrappedLineCount(text: string, maxWidth: number): number {
  if (maxWidth <= 0) return 0;
  return Math.max(1, Math.ceil(Array.from(text).length / maxWidth));
}
