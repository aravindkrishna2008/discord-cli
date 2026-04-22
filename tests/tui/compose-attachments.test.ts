import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  consumeImageAttachmentInput,
  resolvePendingAttachments,
} from "../../src/tui/compose-attachments.js";

function writeIsoImageFile(
  file: string,
  majorBrand: string,
  compatibleBrands: string[],
): void {
  const size = 16 + compatibleBrands.length * 4;
  const buffer = Buffer.alloc(size);
  buffer.writeUInt32BE(size, 0);
  buffer.write("ftyp", 4, "ascii");
  buffer.write(majorBrand, 8, "ascii");
  for (const [index, brand] of compatibleBrands.entries()) {
    buffer.write(brand, 16 + index * 4, "ascii");
  }
  writeFileSync(file, buffer);
}

describe("consumeImageAttachmentInput", () => {
  it("converts a dragged image path into a pending attachment", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const file = join(dir, "sample image.png");
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const out = consumeImageAttachmentInput(JSON.stringify(file), "");

    expect(out).toEqual({
      buffer: "",
      attachments: [{ path: file, name: "sample image.png" }],
    });
  });

  it("keeps existing text when a file path is appended after it", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const file = join(dir, "photo.jpg");
    writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));

    const out = consumeImageAttachmentInput(`caption ${JSON.stringify(file)}`, "caption");

    expect(out).toEqual({
      buffer: "caption",
      attachments: [{ path: file, name: "photo.jpg" }],
    });
  });

  it("ignores non-image paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const file = join(dir, "notes.txt");
    writeFileSync(file, "text");

    expect(consumeImageAttachmentInput(file, "")).toBeNull();
  });

  it("accepts file URLs produced by some terminals", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const file = join(dir, "drop.webp");
    writeFileSync(file, Buffer.from("RIFF1234WEBP", "ascii"));

    const out = consumeImageAttachmentInput(`file://${file}`, "");

    expect(out).toEqual({
      buffer: "",
      attachments: [{ path: file, name: "drop.webp" }],
    });
  });

  it("accepts screenshot paths with escaped ASCII spaces and an unescaped narrow no-break space", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const file = join(dir, "Screenshot 2026-04-20 at 6.45.35 PM.png");
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const pastedPath = file.replaceAll(" ", "\\ ");
    const out = consumeImageAttachmentInput(pastedPath, "");

    expect(out).toEqual({
      buffer: "",
      attachments: [{ path: file, name: "Screenshot 2026-04-20 at 6.45.35 PM.png" }],
    });
  });

  it("accepts HEIC files when the image brand appears in compatible brands", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const file = join(dir, "camera.heic");
    writeIsoImageFile(file, "iso8", ["mif1", "hevx", "heim", "msf1", "heic"]);

    const out = consumeImageAttachmentInput(JSON.stringify(file), "");

    expect(out).toEqual({
      buffer: "",
      attachments: [{ path: file, name: "camera.heic" }],
    });
  });

  it("accepts AVIF files when the avif brand appears later in the ftyp box", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const file = join(dir, "photo.avif");
    writeIsoImageFile(file, "mif1", ["miaf", "MA1B", "iso8", "msf1", "avif"]);

    const out = consumeImageAttachmentInput(JSON.stringify(file), "");

    expect(out).toEqual({
      buffer: "",
      attachments: [{ path: file, name: "photo.avif" }],
    });
  });

  it("rejects files that only look like images by extension", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const fakeImage = join(dir, "fake.png");
    writeFileSync(fakeImage, "not really a png");

    expect(consumeImageAttachmentInput(fakeImage, "")).toBeNull();
  });
});

describe("resolvePendingAttachments", () => {
  it("deduplicates and filters clipboard file paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "discord-cli-compose-"));
    const png = join(dir, "photo.png");
    const txt = join(dir, "notes.txt");
    writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(txt, "text");

    expect(resolvePendingAttachments([png, txt, png])).toEqual([
      { path: png, name: "photo.png" },
    ]);
  });
});
