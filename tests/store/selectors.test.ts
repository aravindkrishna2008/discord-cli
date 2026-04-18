import { describe, it, expect } from "vitest";
import { selectDmList, selectActiveConversation } from "../../src/store/selectors.js";
import { initialState, type State, type DM } from "../../src/store/types.js";

const mk = (s: Partial<State>): State => ({ ...initialState, ...s });
const dm = (id: string, name: string, when: number, unread = false): DM => ({
  id,
  name,
  isGroup: false,
  memberCount: 1,
  lastActivityAt: when,
  unread,
});

describe("selectDmList", () => {
  it("sorts unread first, then by recency desc", () => {
    const state = mk({
      dms: {
        a: dm("a", "alice", 100, false),
        b: dm("b", "bob", 200, true),
        c: dm("c", "carol", 150, false),
      },
    });
    expect(selectDmList(state).map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("filters by case-insensitive substring", () => {
    const state = mk({
      dms: { a: dm("a", "Alice", 1), b: dm("b", "Bob", 2) },
      filter: "ali",
    });
    expect(selectDmList(state).map((d) => d.id)).toEqual(["a"]);
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
