import { type Action, type State, initialState } from "./types.js";

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

    default:
      return state;
  }
}

export { initialState };
