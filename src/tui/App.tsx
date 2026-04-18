import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, render as inkRender, useApp, useInput } from "ink";
import { createStore, type Store } from "../store/store.js";
import type { DiscordClient } from "../discord/client.js";
import { createDiscordClient } from "../discord/client.js";
import { DMList } from "./DMList.js";
import { Conversation } from "./Conversation.js";
import { Input } from "./Input.js";
import { Footer } from "./Footer.js";
import { selectActiveConversation, selectDmList } from "../store/selectors.js";
import { handleKey } from "./keybinds.js";
import { useStore } from "./useStore.js";
import { logError } from "../errors/logger.js";

interface AppProps {
  store: Store;
  client: DiscordClient;
}

export function App({ store, client }: AppProps) {
  const { exit } = useApp();
  const state = useStore(store, (s) => s);
  const list = useMemo(() => selectDmList(state), [state]);
  const conv = useMemo(() => selectActiveConversation(state), [state]);
  const [mode, setMode] = useState<"normal" | "insert">("normal");
  const [buffer, setBuffer] = useState("");
  const fetchingOlder = useRef(false);

  useInput((input, key) => {
    if (mode === "insert") {
      if (key.escape) {
        setMode("normal");
        store.dispatch({ type: "sendError/set", message: null });
      }
      return;
    }
    if (state.filter && /^[a-zA-Z0-9 ]$/.test(input)) {
      store.dispatch({ type: "filter/set", value: state.filter + input });
      return;
    }
    if (state.filter && key.backspace) {
      store.dispatch({ type: "filter/set", value: state.filter.slice(0, -1) });
      return;
    }
    const out = handleKey({ input, key, state });
    for (const a of out.actions) store.dispatch(a);
    if (out.enterInsert) setMode("insert");
    if (out.loadOlder && !fetchingOlder.current) {
      fetchingOlder.current = true;
      const { channelId } = out.loadOlder;
      store.dispatch({ type: "messages/setLoadingOlder", channelId, loading: true });
      const before = state.conversations[channelId]?.oldestFetchedId ?? undefined;
      client
        .fetchHistory(channelId, before, 50)
        .then((older) => {
          store.dispatch({
            type: "messages/prependHistory",
            channelId,
            messages: older,
            reachedBeginning: older.length < 50,
          });
        })
        .catch((e) => logError("fetchHistory", e))
        .finally(() => {
          fetchingOlder.current = false;
        });
    }
    if (out.exit) exit();
  });

  useEffect(() => {
    if (!state.activeDmId) return;
    const conv = state.conversations[state.activeDmId];
    if (conv && conv.messages.length > 0) return;
    const id = state.activeDmId;
    client
      .fetchHistory(id, undefined, 50)
      .then((messages) => {
        store.dispatch({ type: "messages/appendHistory", channelId: id, messages });
      })
      .catch((e) => logError("fetchHistory:initial", e));
  }, [state.activeDmId]);

  const active = state.activeDmId ? state.dms[state.activeDmId] : null;

  return (
    <Box flexDirection="column">
      <Box>
        <DMList items={list} selectedId={state.activeDmId} focused={state.focus === "list"} filter={state.filter} />
        <Box flexDirection="column" flexGrow={1}>
          <Conversation view={conv} title={active?.name ?? "(no DM)"} focused={state.focus === "conversation"} />
          <Input
            mode={mode}
            value={buffer}
            sendError={state.sendError}
            onChange={setBuffer}
            onSubmit={() => {
              const content = buffer.trim();
              if (!content || !state.activeDmId) return;
              const channelId = state.activeDmId;
              setBuffer("");
              setMode("normal");
              client.send(channelId, content).catch((e) => {
                store.dispatch({ type: "sendError/set", message: (e as Error).message });
              });
            }}
          />
        </Box>
      </Box>
      <Footer connection={state.connection} mode={mode} />
    </Box>
  );
}

export async function runTui(token: string): Promise<void> {
  const store = createStore();
  const client = createDiscordClient();

  client.on("connectionChange", (status) =>
    store.dispatch({ type: "connection/set", status }),
  );
  client.on("ready", () => store.dispatch({ type: "connection/set", status: "connected" }));
  client.on("dms", (dms) => store.dispatch({ type: "dms/upsertMany", dms }));
  client.on("message", (message) => {
    store.dispatch({ type: "messages/appendLive", message });
    if (store.getState().activeDmId !== message.channelId) {
      store.dispatch({ type: "dms/markUnread", dmId: message.channelId });
    }
  });
  client.on("error", (e) => logError("discord.client", e));

  await client.login(token);
  inkRender(<App store={store} client={client} />);
}
