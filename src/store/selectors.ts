import type { ConversationView, DM, State } from "./types.js";

export function selectDmList(state: State): DM[] {
  const filter = state.filter.toLowerCase();
  const all = Object.values(state.dms);
  const filtered = filter ? all.filter((d) => d.name.toLowerCase().includes(filter)) : all;
  return filtered.sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return b.lastActivityAt - a.lastActivityAt;
  });
}

export function selectActiveConversation(state: State): ConversationView | null {
  if (!state.activeDmId) return null;
  return state.conversations[state.activeDmId] ?? null;
}
