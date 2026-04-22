import { describe, expect, it } from "vitest";
import { toFixedHeightBlock, toFixedHeightPlainTextBlock } from "../../src/tui/image-block.js";

describe("toFixedHeightBlock", () => {
  it("pads shorter content up to the reserved height", () => {
    expect(toFixedHeightBlock("first", 3)).toBe("first\n\n");
  });

  it("truncates extra lines beyond the reserved height", () => {
    expect(toFixedHeightBlock("one\ntwo\nthree", 2)).toBe("one\ntwo");
  });
});

describe("toFixedHeightPlainTextBlock", () => {
  it("truncates each line to the available width", () => {
    expect(toFixedHeightPlainTextBlock("abcdefgh", 4, 1)).toBe("abc…");
  });
});
