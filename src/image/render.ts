import terminalImage from "terminal-image";
import type { RenderProtocol } from "./protocol.js";

export const DEFAULT_IMAGE_PREVIEW_HEIGHT = 6;

export interface RenderOptions {
  protocol: RenderProtocol;
  maxWidth?: number;
  maxHeight?: number;
}

export async function renderImageFromUrl(url: string, opts: RenderOptions): Promise<string | null> {
  if (opts.protocol === "none") return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await terminalImage.buffer(buf, {
      width: opts.maxWidth ?? 40,
      height: opts.maxHeight ?? 20,
      preserveAspectRatio: true,
    });
  } catch {
    return null;
  }
}

export function getImagePreviewHeight(messageRows: number): number {
  if (messageRows < 3) return 1;
  return Math.max(2, Math.min(DEFAULT_IMAGE_PREVIEW_HEIGHT, messageRows - 1));
}

export function placeholderFor(name: string, size: number): string {
  return `[image: ${name} (${formatBytes(size)})]`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
