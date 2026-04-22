import { existsSync, openSync, readSync, statSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface PendingAttachment {
  path: string;
  name: string;
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".avif",
]);

const FILE_HEADER_BYTES = 128;

const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

const AVIF_BRANDS = new Set([
  "avif",
  "avis",
]);

export function consumeImageAttachmentInput(
  nextValue: string,
  previousValue: string,
): { buffer: string; attachments: PendingAttachment[] } | null {
  const appendedValue = nextValue.startsWith(previousValue)
    ? nextValue.slice(previousValue.length)
    : null;

  if (appendedValue) {
    const attachments = parseImageAttachmentTokens(appendedValue);
    if (attachments.length > 0) return { buffer: previousValue, attachments };
  }

  const attachments = parseImageAttachmentTokens(nextValue);
  if (attachments.length > 0) return { buffer: "", attachments };

  return null;
}

export function resolvePendingAttachments(paths: string[]): PendingAttachment[] {
  const attachments: PendingAttachment[] = [];
  for (const path of paths) {
    const resolvedPath = resolveLocalPath(path);
    if (!resolvedPath) continue;
    if (!isImageFile(resolvedPath)) continue;
    attachments.push({ path: resolvedPath, name: basename(resolvedPath) });
  }
  return dedupeAttachments(attachments);
}

function parseImageAttachmentTokens(raw: string): PendingAttachment[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const tokens = tokenizeShellInput(trimmed);
  if (tokens.length === 0) return [];
  const attachments = resolvePendingAttachments(tokens);
  return attachments.length === tokens.length ? attachments : [];
}

function tokenizeShellInput(raw: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const char of raw) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (isShellWhitespace(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) current += "\\";
  if (quote) return [];
  if (current) tokens.push(current);
  return tokens;
}

function isShellWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function resolveLocalPath(token: string): string | null {
  if (!token) return null;

  if (token.startsWith("file://")) {
    try {
      return fileURLToPath(token);
    } catch {
      return null;
    }
  }

  if (token === "~") return homedir();
  if (token.startsWith("~/")) return resolve(homedir(), token.slice(2));
  return resolve(token);
}

function isImageFile(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return false;
  if (!existsSync(filePath)) return false;
  try {
    if (!statSync(filePath).isFile()) return false;
    const header = readFileHeader(filePath);
    return matchesImageSignature(header, extension);
  } catch {
    return false;
  }
}

function readFileHeader(filePath: string): Uint8Array {
  const file = openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(FILE_HEADER_BYTES);
    const bytesRead = readSync(file, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(file);
  }
}

function matchesImageSignature(header: Uint8Array, extension: string): boolean {
  if (header.length === 0) return false;

  if (extension === ".png") return startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47]);
  if (extension === ".jpg" || extension === ".jpeg") {
    return startsWithBytes(header, [0xff, 0xd8, 0xff]);
  }
  if (extension === ".gif") {
    return startsWithAscii(header, "GIF87a") || startsWithAscii(header, "GIF89a");
  }
  if (extension === ".webp") {
    return startsWithAscii(header, "RIFF") && asciiAt(header, 8, 4) === "WEBP";
  }
  if (extension === ".bmp") return startsWithAscii(header, "BM");
  if (extension === ".tif" || extension === ".tiff") {
    return startsWithBytes(header, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(header, [0x4d, 0x4d, 0x00, 0x2a]);
  }
  if (extension === ".heic" || extension === ".heif") return matchesIsoBaseMediaSignature(header, HEIF_BRANDS);
  if (extension === ".avif") return matchesIsoBaseMediaSignature(header, AVIF_BRANDS);
  return false;
}

function matchesIsoBaseMediaSignature(header: Uint8Array, expectedBrands: Set<string>): boolean {
  const brands = readIsoBaseMediaBrands(header);
  return brands.some((brand) => expectedBrands.has(brand));
}

function startsWithBytes(header: Uint8Array, expected: number[]): boolean {
  if (header.length < expected.length) return false;
  return expected.every((value, index) => header[index] === value);
}

function startsWithAscii(header: Uint8Array, text: string): boolean {
  return asciiAt(header, 0, text.length) === text;
}

function asciiAt(header: Uint8Array, start: number, length: number): string {
  if (header.length < start + length) return "";
  return Buffer.from(header.subarray(start, start + length)).toString("ascii");
}

function readIsoBaseMediaBrands(header: Uint8Array): string[] {
  if (asciiAt(header, 4, 4) !== "ftyp") return [];
  const boxSize = uint32At(header, 0);
  if (boxSize !== null && boxSize !== 0 && boxSize < 16) return [];

  const boxEnd = boxSize && boxSize <= header.length ? boxSize : header.length;
  const brands: string[] = [];

  for (let offset = 8; offset + 4 <= boxEnd; offset += 4) {
    if (offset === 12) continue;
    const brand = asciiAt(header, offset, 4).toLowerCase();
    if (brand.length === 4) brands.push(brand);
  }

  return brands;
}

function uint32At(header: Uint8Array, start: number): number | null {
  if (header.length < start + 4) return null;
  return Buffer.from(header.subarray(start, start + 4)).readUInt32BE(0);
}

function dedupeAttachments(attachments: PendingAttachment[]): PendingAttachment[] {
  const seen = new Set<string>();
  return attachments.filter((attachment) => {
    if (seen.has(attachment.path)) return false;
    seen.add(attachment.path);
    return true;
  });
}
