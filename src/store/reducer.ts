import {
  type Action,
  type ConversationView,
  type Message,
  type State,
  initialState,
} from "./types.js";

function ensureConversation(state: State, channelId: string): ConversationView {
  return (
    state.conversations[channelId] ?? {
      messages: [],
      oldestFetchedId: null,
      reachedBeginning: false,
      loadingOlder: false,
      scrollOffsetFromBottom: 0,
      pendingNewCount: 0,
    }
  );
}

function setConversation(state: State, channelId: string, conv: ConversationView): State {
  return { ...state, conversations: { ...state.conversations, [channelId]: conv } };
}

function sortByCreatedAt(msgs: Message[]): Message[] {
  return [...msgs].sort((a, b) => a.createdAt - b.createdAt);
}

export function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "connection/set":
      return { ...state, connection: action.status };

    case "dms/upsertMany": {
      const dms = { ...state.dms };
      for (const incoming of action.dms) {
        const existing = dms[incoming.id];
        dms[incoming.id] = existing
          ? { ...incoming, unread: existing.unread || incoming.unread }
          : incoming;
      }
      return { ...state, dms };
    }

    case "dms/markUnread": {
      if (state.activeDmId === action.dmId) return state;
      const dm = state.dms[action.dmId];
      if (!dm || dm.unread) return state;
      return { ...state, dms: { ...state.dms, [action.dmId]: { ...dm, unread: true } } };
    }

    case "dms/clearUnread": {
      const dm = state.dms[action.dmId];
      if (!dm || !dm.unread) return state;
      return { ...state, dms: { ...state.dms, [action.dmId]: { ...dm, unread: false } } };
    }

    case "active/set": {
      let dms = state.dms;
      if (action.dmId && dms[action.dmId]?.unread) {
        dms = { ...dms, [action.dmId]: { ...dms[action.dmId], unread: false } };
      }
      return { ...state, activeDmId: action.dmId, dms };
    }

    case "focus/set":
      return { ...state, focus: action.focus };

    case "filter/set":
      return { ...state, filter: action.value };

    case "sendError/set":
      return { ...state, sendError: action.message };

    case "messages/appendLive": {
      const conv = ensureConversation(state, action.message.channelId);
      if (conv.messages.some((m) => m.id === action.message.id)) return state;
      const messages = [...conv.messages, action.message];
      const scrolledUp = conv.scrollOffsetFromBottom > 0;
      return setConversation(state, action.message.channelId, {
        ...conv,
        messages,
        pendingNewCount: scrolledUp ? conv.pendingNewCount + 1 : 0,
      });
    }

    case "messages/appendHistory": {
      const conv = ensureConversation(state, action.channelId);
      const merged = sortByCreatedAt([
        ...conv.messages,
        ...action.messages.filter((m) => !conv.messages.some((c) => c.id === m.id)),
      ]);
      return setConversation(state, action.channelId, {
        ...conv,
        messages: merged,
        oldestFetchedId: merged[0]?.id ?? null,
      });
    }

    case "messages/prependHistory": {
      const conv = ensureConversation(state, action.channelId);
      const older = action.messages.filter((m) => !conv.messages.some((c) => c.id === m.id));
      const merged = sortByCreatedAt([...older, ...conv.messages]);
      return setConversation(state, action.channelId, {
        ...conv,
        messages: merged,
        oldestFetchedId: merged[0]?.id ?? conv.oldestFetchedId,
        reachedBeginning: action.reachedBeginning,
        loadingOlder: false,
      });
    }

    case "messages/setLoadingOlder": {
      const conv = ensureConversation(state, action.channelId);
      return setConversation(state, action.channelId, { ...conv, loadingOlder: action.loading });
    }

    case "scroll/set": {
      const conv = ensureConversation(state, action.channelId);
      const pendingNewCount = action.offsetFromBottom === 0 ? 0 : conv.pendingNewCount;
      return setConversation(state, action.channelId, {
        ...conv,
        scrollOffsetFromBottom: action.offsetFromBottom,
        pendingNewCount,
      });
    }

    case "scroll/consumePending": {
      const conv = ensureConversation(state, action.channelId);
      return setConversation(state, action.channelId, { ...conv, pendingNewCount: 0 });
    }

    default:
      return state;
  }
}

export { initialState };
