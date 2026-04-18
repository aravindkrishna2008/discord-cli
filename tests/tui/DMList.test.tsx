import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { DMList } from "../../src/tui/DMList.js";
import type { DM } from "../../src/store/types.js";

const dm = (over: Partial<DM> & { id: string; name: string }): DM => ({
  id: over.id,
  name: over.name,
  isGroup: false,
  memberCount: 1,
  lastActivityAt: 0,
  unread: false,
  ...over,
});

describe("DMList", () => {
  it("renders each DM's name", () => {
    const { lastFrame } = render(
      <DMList
        items={[dm({ id: "1", name: "alice" }), dm({ id: "2", name: "bob" })]}
        selectedId="1"
        focused
        filter=""
      />,
    );
    expect(lastFrame()).toContain("alice");
    expect(lastFrame()).toContain("bob");
  });

  it("shows bullet for unread DMs", () => {
    const { lastFrame } = render(
      <DMList
        items={[dm({ id: "1", name: "alice", unread: true })]}
        selectedId={null}
        focused
        filter=""
      />,
    );
    expect(lastFrame()).toContain("\u25CF");
  });

  it("shows (N) for group DMs", () => {
    const { lastFrame } = render(
      <DMList
        items={[dm({ id: "2", name: "study-group", isGroup: true, memberCount: 3 })]}
        selectedId={null}
        focused
        filter=""
      />,
    );
    expect(lastFrame()).toContain("study-group");
    expect(lastFrame()).toContain("(3)");
  });

  it("shows filter prompt when filter is non-empty", () => {
    const { lastFrame } = render(
      <DMList items={[]} selectedId={null} focused filter="ali" />,
    );
    expect(lastFrame()).toContain("/ali");
  });
});
