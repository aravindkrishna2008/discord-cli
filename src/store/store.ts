import { initialState, type Action, type State } from "./types.js";
import { reduce } from "./reducer.js";

export type Listener = (state: State) => void;

export interface Store {
  getState(): State;
  dispatch(action: Action): void;
  subscribe(l: Listener): () => void;
}

export function createStore(preloaded: State = initialState): Store {
  let state = preloaded;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    dispatch(action) {
      state = reduce(state, action);
      for (const l of listeners) l(state);
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
