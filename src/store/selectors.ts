import type { ConversationView, DM, State } from "./types.js";

export function selectDmList(state: State): DM[] {
  const filter = state.filter.toLowerCase();
  const all = Object.values(state.dms);
  const filtered = filter ? all.filter((d) => d.name.toLowerCase().includes(filter)) : all;
  return filtered.sort((a, b) => {
    const activityDiff = b.lastActivityAt - a.lastActivityAt;
    if (activityDiff !== 0) return activityDiff;
    return a.name.localeCompare(b.name);
  });
}

export function selectActiveConversation(state: State): ConversationView | null {
  if (!state.activeDmId) return null;
  return state.conversations[state.activeDmId] ?? null;
}
