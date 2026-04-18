import { describe, it, expect } from "vitest";
import { selectDmList, selectActiveConversation } from "../../src/store/selectors.js";
import { initialState, type State, type DM } from "../../src/store/types.js";

const mk = (s: Partial<State>): State => ({ ...initialState, ...s });
const dm = (
  id: string,
  name: string,
  when: number,
  unread = false,
  over: Partial<DM> = {},
): DM => ({
  id,
  name,
  isGroup: false,
  memberCount: 1,
  lastActivityAt: when,
  unread,
  ...over,
});

describe("selectDmList", () => {
  it("sorts by most recent activity, regardless of unread state", () => {
    const state = mk({
      dms: {
        a: dm("a", "alice", 100, false),
        b: dm("b", "bob", 200, true),
        c: dm("c", "carol", 150, false),
      },
    });
    expect(selectDmList(state).map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps DMs and group chats in one recency-sorted list", () => {
    const state = mk({
      dms: {
        dm1: dm("dm1", "alice", 100),
        gc1: dm("gc1", "study-group", 300, false, { isGroup: true, memberCount: 3 }),
        dm2: dm("dm2", "bob", 200),
      },
    });
    expect(selectDmList(state).map((d) => d.id)).toEqual(["gc1", "dm2", "dm1"]);
  });

  it("filters by case-insensitive substring", () => {
    const state = mk({
      dms: { a: dm("a", "Alice", 1), b: dm("b", "Bob", 2) },
      filter: "ali",
    });
    expect(selectDmList(state).map((d) => d.id)).toEqual(["a"]);
  });

  it("matches group chats by name too", () => {
    const state = mk({
      dms: {
        dm1: dm("dm1", "Alice", 1),
        gc1: dm("gc1", "Study Group", 2, false, { isGroup: true, memberCount: 4 }),
      },
      filter: "study",
    });
    expect(selectDmList(state).map((d) => d.id)).toEqual(["gc1"]);
  });
});

describe("selectActiveConversation", () => {
  it("returns null when no active DM", () => {
    expect(selectActiveConversation(initialState)).toBeNull();
  });

  it("returns the conversation when active", () => {
    const state = mk({
      activeDmId: "1",
      conversations: {
        "1": {
          messages: [],
          oldestFetchedId: null,
          reachedBeginning: false,
          loadingOlder: false,
          scrollOffsetFromBottom: 0,
          pendingNewCount: 0,
        },
      },
    });
    expect(selectActiveConversation(state)).not.toBeNull();
  });
});
