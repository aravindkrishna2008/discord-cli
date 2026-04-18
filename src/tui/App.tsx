import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, render as inkRender, useApp, useInput, useStdout } from "ink";
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
import { loadConfig } from "../config/config.js";
import { paths } from "../config/paths.js";

const config = loadConfig(paths.configFile);
type Mode = "normal" | "insert" | "search";

interface AppProps {
  store: Store;
  client: DiscordClient;
}

export function App({ store, client }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const state = useStore(store, (s) => s);
  const list = useMemo(() => selectDmList(state), [state]);
  const conv = useMemo(() => selectActiveConversation(state), [state]);
  const [mode, setMode] = useState<Mode>("normal");
  const [buffer, setBuffer] = useState("");
  const fetchingOlder = useRef(false);
  const [terminalSize, setTerminalSize] = useState(() => getTerminalSize(stdout));
  const footerHeight = 1;
  const mainHeight = Math.max(2, terminalSize.height - footerHeight);
  const desiredInputHeight = state.sendError ? 2 : 1;
  const inputHeight = Math.min(desiredInputHeight, Math.max(1, mainHeight - 1));
  const conversationHeight = Math.max(1, mainHeight - inputHeight);
  const listWidth = getListWidth(terminalSize.width);
  const conversationWidth = Math.max(1, terminalSize.width - listWidth);
  const conversationLayout = getConversationLayout(conversationWidth, conversationHeight, conv);

  useEffect(() => {
    const handleResize = () => setTerminalSize(getTerminalSize(stdout));
    handleResize();
    stdout.on("resize", handleResize);
    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  useInput((input, key) => {
    if (mode === "insert") {
      if (key.escape) {
        setMode("normal");
        store.dispatch({ type: "sendError/set", message: null });
      }
      return;
    }
    if (mode === "search") {
      if (key.escape) {
        setMode("normal");
        store.dispatch({ type: "filter/set", value: "" });
      }
      return;
    }
    if (input === "/") {
      setMode("search");
      store.dispatch({ type: "focus/set", focus: "list" });
      return;
    }
    const out = handleKey({ input, key, state, conversationLayout });
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

  useEffect(() => {
    if (!state.filter) return;
    if (list.some((dm) => dm.id === state.activeDmId)) return;
    const nextId = list[0]?.id ?? null;
    if (nextId !== state.activeDmId) {
      store.dispatch({ type: "active/set", dmId: nextId });
    }
  }, [list, state.activeDmId, state.filter, store]);

  const active = state.activeDmId ? state.dms[state.activeDmId] : null;
  const listFocused = mode === "search" || state.focus === "list";

  return (
    <Box
      flexDirection="column"
      width={terminalSize.width}
      height={terminalSize.height}
      overflow="hidden"
    >
      <Box height={mainHeight} overflow="hidden">
        <DMList
          items={list}
          selectedId={state.activeDmId}
          focused={listFocused}
          filter={state.filter}
          searching={mode === "search"}
          onFilterChange={(value) => store.dispatch({ type: "filter/set", value })}
          onFilterSubmit={() => setMode("normal")}
          width={listWidth}
          height={mainHeight}
        />
        <Box
          flexDirection="column"
          width={conversationWidth}
          height={mainHeight}
          overflow="hidden"
        >
          <Conversation
            view={conv}
            title={active?.name ?? "(no DM)"}
            focused={state.focus === "conversation"}
            imageProtocol={config.imageProtocol}
            width={conversationWidth}
            height={conversationHeight}
          />
          <Input
            mode={mode}
            value={buffer}
            sendError={state.sendError}
            width={conversationWidth}
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
      <Footer connection={state.connection} mode={mode} width={terminalSize.width} />
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

function getTerminalSize(stdout: NodeJS.WriteStream): { width: number; height: number } {
  return {
    width: Math.max(20, stdout.columns ?? 80),
    height: Math.max(8, stdout.rows ?? 24),
  };
}

function getListWidth(totalWidth: number): number {
  const preferred = totalWidth <= 24
    ? Math.max(8, Math.floor(totalWidth / 3))
    : Math.min(30, Math.max(18, Math.floor(totalWidth * 0.3)));
  return Math.max(1, Math.min(preferred, totalWidth - 1));
}

function getConversationLayout(
  width: number,
  height: number,
  view: ReturnType<typeof selectActiveConversation>,
): { contentWidth: number; messageRows: number } {
  const contentWidth = Math.max(1, width - 4);
  const loadingRows = view?.loadingOlder ? 1 : 0;
  const pendingRows = view && view.scrollOffsetFromBottom > 0 && view.pendingNewCount > 0 ? 1 : 0;
  return {
    contentWidth,
    messageRows: Math.max(0, height - 4 - loadingRows - pendingRows),
  };
}
