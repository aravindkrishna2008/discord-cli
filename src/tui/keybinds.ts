import type { Key } from "ink";
import type { Action, State } from "../store/types.js";
import { selectDmList } from "../store/selectors.js";

export interface KeyContext {
  input: string;
  key: Key;
  state: State;
}

export interface KeyOutcome {
  actions: Action[];
  enterInsert?: boolean;
  loadOlder?: { channelId: string };
  exit?: boolean;
}

export function handleKey(ctx: KeyContext): KeyOutcome {
  const { input, key, state } = ctx;
  const out: KeyOutcome = { actions: [] };

  if (input === "q") {
    out.exit = true;
    return out;
  }
  if (key.escape && state.filter) {
    out.actions.push({ type: "filter/set", value: "" });
    return out;
  }
  if (input === "h" || key.leftArrow) {
    out.actions.push({ type: "focus/set", focus: "list" });
    return out;
  }
  if (input === "l" || key.rightArrow) {
    out.actions.push({ type: "focus/set", focus: "conversation" });
    return out;
  }

  if (state.focus === "list") {
    const list = selectDmList(state);
    const idx = list.findIndex((d) => d.id === state.activeDmId);
    if (input === "j" || key.downArrow) {
      const next = list[Math.min(list.length - 1, idx + 1)];
      if (next) out.actions.push({ type: "active/set", dmId: next.id });
    } else if (input === "k" || key.upArrow) {
      const prev = list[Math.max(0, idx - 1)];
      if (prev) out.actions.push({ type: "active/set", dmId: prev.id });
    } else if (key.return && state.activeDmId) {
      out.actions.push({ type: "focus/set", focus: "conversation" });
    }
    return out;
  }

  // focus === "conversation"
  if (input === "i" && state.activeDmId) {
    out.enterInsert = true;
    return out;
  }
  if ((input === "k" || key.upArrow) && state.activeDmId) {
    const conv = state.conversations[state.activeDmId];
    if (conv && !conv.reachedBeginning && !conv.loadingOlder && conv.oldestFetchedId) {
      out.loadOlder = { channelId: state.activeDmId };
    }
  }
  return out;
}
