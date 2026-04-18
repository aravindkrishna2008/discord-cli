import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Input } from "../../src/tui/Input.js";

describe("Input", () => {
  it("shows prompt placeholder in normal mode", () => {
    const { lastFrame } = render(
      <Input mode="normal" value="" sendError={null} onChange={() => {}} onSubmit={() => {}} />,
    );
    expect(lastFrame()).toContain("press i to type");
  });

  it("shows the buffer and prompt in insert mode", () => {
    const { lastFrame } = render(
      <Input
        mode="insert"
        value="hello"
        sendError={null}
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
        sendError="nope"
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(lastFrame()).toContain("nope");
  });
});
