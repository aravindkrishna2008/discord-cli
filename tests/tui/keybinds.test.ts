import { describe, expect, it } from "vitest";
import { handleKey } from "../../src/tui/keybinds.js";
import { initialState, type ConversationView, type Message, type State } from "../../src/store/types.js";

const msg = (over: Partial<Message> & { id: string }): Message => ({
  channelId: "1",
  authorId: "u1",
  authorName: "alice",
  content: "hello",
  createdAt: 0,
  attachments: [],
  ...over,
});

const conversation = (
  messages: Message[],
  extra: Partial<ConversationView> = {},
): ConversationView => ({
  messages,
  oldestFetchedId: messages[0]?.id ?? null,
  reachedBeginning: false,
  loadingOlder: false,
  scrollOffsetFromBottom: 0,
  pendingNewCount: 0,
  ...extra,
});

const stateWithConversation = (conv: ConversationView): State => ({
  ...initialState,
  activeDmId: "1",
  focus: "conversation",
  conversations: {
    "1": conv,
  },
});

describe("handleKey — conversation scrolling", () => {
  it("scrolls up through loaded messages before fetching more", () => {
    const outcome = handleKey({
      input: "k",
      key: {} as never,
      state: stateWithConversation(
        conversation([
          msg({ id: "m1", content: "first" }),
          msg({ id: "m2", content: "second" }),
          msg({ id: "m3", content: "third" }),
        ]),
      ),
      conversationLayout: {
        contentWidth: 36,
        messageRows: 4,
        imagePreviewHeight: 4,
      },
    });

    expect(outcome.actions).toEqual([
      { type: "scroll/set", channelId: "1", offsetFromBottom: 1 },
    ]);
    expect(outcome.loadOlder).toBeUndefined();
  });

  it("requests older history after reaching the top of loaded messages", () => {
    const outcome = handleKey({
      input: "k",
      key: {} as never,
      state: stateWithConversation(
        conversation(
          [
            msg({ id: "m1", content: "first" }),
            msg({ id: "m2", content: "second" }),
            msg({ id: "m3", content: "third" }),
          ],
          { scrollOffsetFromBottom: 1 },
        ),
      ),
      conversationLayout: {
        contentWidth: 36,
        messageRows: 4,
        imagePreviewHeight: 4,
      },
    });

    expect(outcome.actions).toEqual([]);
    expect(outcome.loadOlder).toEqual({ channelId: "1" });
  });

  it("scrolls back down toward the latest messages", () => {
    const outcome = handleKey({
      input: "j",
      key: {} as never,
      state: stateWithConversation(
        conversation([msg({ id: "m1" }), msg({ id: "m2" })], { scrollOffsetFromBottom: 1 }),
      ),
    });

    expect(outcome.actions).toEqual([
      { type: "scroll/set", channelId: "1", offsetFromBottom: 0 },
    ]);
  });
});
