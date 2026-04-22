import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Input } from "../../src/tui/Input.js";

describe("Input", () => {
  it("shows prompt placeholder in normal mode", () => {
    const { lastFrame } = render(
      <Input mode="normal" value="" sendError={null} width={40} onChange={() => {}} onSubmit={() => {}} />,
    );
    expect(lastFrame()).toContain("press i to type");
  });

  it("shows the buffer and prompt in insert mode", () => {
    const { lastFrame } = render(
      <Input
        mode="insert"
        value="hello"
        attachmentSummary={null}
        sendError={null}
        width={40}
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(lastFrame()).toContain("hello");
  });

  it("renders the send error below input", () => {
    const { lastFrame } = render(
      <Input
        mode="insert"
        value=""
        attachmentSummary={null}
        sendError="nope"
        width={40}
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(lastFrame()).toContain("nope");
  });

  it("renders the attachment summary below input", () => {
    const { lastFrame } = render(
      <Input
        mode="insert"
        value=""
        attachmentSummary="[Image: photo.png]"
        sendError={null}
        width={40}
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(lastFrame()).toContain("[Image: photo.png]");
  });
});
