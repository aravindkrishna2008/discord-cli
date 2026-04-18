import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { DMList } from "../../src/tui/DMList.js";
import type { DM } from "../../src/store/types.js";

const dm = (over: Partial<DM> & { id: string; name: string }): DM => ({
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
        searching={false}
        onFilterChange={() => {}}
        onFilterSubmit={() => {}}
        width={30}
        height={10}
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
        searching={false}
        onFilterChange={() => {}}
        onFilterSubmit={() => {}}
        width={30}
        height={10}
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
        searching={false}
        onFilterChange={() => {}}
        onFilterSubmit={() => {}}
        width={30}
        height={10}
      />,
    );
    expect(lastFrame()).toContain("study-group");
    expect(lastFrame()).toContain("(3)");
  });

  it("shows the search query when filter is non-empty", () => {
    const { lastFrame } = render(
      <DMList
        items={[]}
        selectedId={null}
        focused
        filter="ali"
        searching={false}
        onFilterChange={() => {}}
        onFilterSubmit={() => {}}
        width={30}
        height={10}
      />,
    );
    expect(lastFrame()).toContain("ali");
  });

  it("shows the search placeholder when there is no query", () => {
    const { lastFrame } = render(
      <DMList
        items={[]}
        selectedId={null}
        focused
        filter=""
        searching={false}
        onFilterChange={() => {}}
        onFilterSubmit={() => {}}
        width={30}
        height={10}
      />,
    );
    expect(lastFrame()).toContain("search by name");
  });

  it("keeps the selected DM visible within the available height", () => {
    const { lastFrame } = render(
      <DMList
        items={[
          dm({ id: "1", name: "alice" }),
          dm({ id: "2", name: "bob" }),
          dm({ id: "3", name: "carol" }),
          dm({ id: "4", name: "dave" }),
        ]}
        selectedId="4"
        focused
        filter=""
        searching={false}
        onFilterChange={() => {}}
        onFilterSubmit={() => {}}
        width={30}
        height={6}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("dave");
    expect(frame).not.toContain("alice");
  });
});
