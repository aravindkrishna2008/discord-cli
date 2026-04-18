import { useEffect, useState } from "react";
import type { Store } from "../store/store.js";

export function useStore<T>(store: Store, selector: (s: ReturnType<Store["getState"]>) => T): T {
  const [value, setValue] = useState(() => selector(store.getState()));
  useEffect(
    () => store.subscribe((s) => setValue(selector(s))),
    [store, selector],
  );
  return value;
}
