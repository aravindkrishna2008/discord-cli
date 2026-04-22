import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, render as inkRender, useApp, useInput, useStdout } from "ink";
import { createStore, type Store } from "../store/store.js";
import type { DiscordClient } from "../discord/client.js";
import { DMList } from "./DMList.js";
import { Conversation } from "./Conversation.js";
import { Input } from "./Input.js";
import { Footer } from "./Footer.js";
import { selectActiveConversation, selectDmList } from "../store/selectors.js";
import { handleKey } from "./keybinds.js";
import { useStore } from "./useStore.js";
import { logError } from "../errors/logger.js";
import { createSession } from "../runtime/session.js";
import { HISTORY_PAGE_SIZE, loadDmMessages, sendDmMessage } from "../runtime/dm-actions.js";
import {
  consumeImageAttachmentInput,
  type PendingAttachment,
  resolvePendingAttachments,
} from "./compose-attachments.js";
import { readClipboardImagePaths, readClipboardText } from "./clipboard-image.js";
import { openImageInBrowser } from "../image/open.js";
import { getVisibleImageShortcuts } from "./conversation-window.js";
type Mode = "normal" | "insert" | "search";

interface AppProps {
  store: Store;
  client: DiscordClient;
  onExit?(): void | Promise<void>;
}

export function App({ store, client, onExit }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const state = useStore(store, (s) => s);
  const list = useMemo(() => selectDmList(state), [state]);
  const conv = useMemo(() => selectActiveConversation(state), [state]);
  const [mode, setMode] = useState<Mode>("normal");
  const [buffer, setBuffer] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const bufferRef = useRef(buffer);
  const pendingAttachmentsRef = useRef(pendingAttachments);
  const fetchingOlder = useRef(false);
  const attachingClipboard = useRef(false);
  const [terminalSize, setTerminalSize] = useState(() => getTerminalSize(stdout));
  const footerHeight = 1;
  const mainHeight = Math.max(2, terminalSize.height - footerHeight);
  const desiredInputHeight = 1 + (pendingAttachments.length > 0 ? 1 : 0) + (state.sendError ? 1 : 0);
  const inputHeight = Math.min(desiredInputHeight, Math.max(1, mainHeight - 1));
  const conversationHeight = Math.max(1, mainHeight - inputHeight);
  const listWidth = getListWidth(terminalSize.width);
  const conversationWidth = Math.max(1, terminalSize.width - listWidth);
  const conversationLayout = getConversationLayout(conversationWidth, conversationHeight, conv);
  const visibleImageShortcuts = useMemo(
    () =>
      conv
        ? getVisibleImageShortcuts(
            conv.messages,
            conversationLayout.contentWidth,
            conversationLayout.messageRows,
            conv.scrollOffsetFromBottom,
          )
        : [],
    [conv, conversationLayout.contentWidth, conversationLayout.messageRows],
  );
  const imageShortcutLabels = useMemo(
    () => new Map(visibleImageShortcuts.map((item) => [item.attachmentId, `[${item.digit}]`])),
    [visibleImageShortcuts],
  );

  useEffect(() => {
    const handleResize = () => setTerminalSize(getTerminalSize(stdout));
    handleResize();
    stdout.on("resize", handleResize);
    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  useEffect(() => () => {
    void onExit?.();
  }, [onExit]);

  useInput((input, key) => {
    if (mode === "insert") {
      if (
        state.activeDmId &&
        !attachingClipboard.current &&
        ((key.ctrl && input === "v") || (key.meta && input.toLowerCase() === "v") || input === "\u0016")
      ) {
        attachingClipboard.current = true;
        void attachClipboardImage()
          .catch((e) => {
            store.dispatch({ type: "sendError/set", message: (e as Error).message });
          })
          .finally(() => {
            attachingClipboard.current = false;
          });
        return;
      }
      if (
        key.backspace &&
        bufferRef.current.length === 0 &&
        pendingAttachmentsRef.current.length > 0
      ) {
        replacePendingAttachments(pendingAttachmentsRef.current.slice(0, -1));
        store.dispatch({ type: "sendError/set", message: null });
        return;
      }
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
    if (
      mode === "normal" &&
      state.focus === "conversation" &&
      /^[1-9]$/.test(input)
    ) {
      const match = visibleImageShortcuts.find((item) => item.digit === input);
      if (match) {
        void openImageInBrowser(match.url).catch((e) => {
          store.dispatch({ type: "sendError/set", message: (e as Error).message });
        });
        return;
      }
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
      loadDmMessages(client, { channelId, beforeId: before, limit: HISTORY_PAGE_SIZE })
        .then((older) => {
          store.dispatch({
            type: "messages/prependHistory",
            channelId,
            messages: older,
            reachedBeginning: older.length < HISTORY_PAGE_SIZE,
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
    loadDmMessages(client, { channelId: id, limit: HISTORY_PAGE_SIZE })
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
  const attachmentSummary =
    pendingAttachments.length === 0
      ? null
      : pendingAttachments.map((attachment) => `[Image: ${attachment.name}]`).join(" ");

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
            width={conversationWidth}
            height={conversationHeight}
            imageShortcutLabels={imageShortcutLabels}
          />
          <Input
            mode={mode}
            value={buffer}
            attachmentSummary={attachmentSummary}
            sendError={state.sendError}
            width={conversationWidth}
            onChange={(nextValue) => {
              const attachmentInput = consumeImageAttachmentInput(nextValue, bufferRef.current);
              if (attachmentInput) {
                appendPendingAttachments(attachmentInput.attachments);
                replaceBuffer(attachmentInput.buffer);
                store.dispatch({ type: "sendError/set", message: null });
                return;
              }
              replaceBuffer(nextValue);
            }}
            onSubmit={() => {
              const content = bufferRef.current.trim();
              const attachments = pendingAttachmentsRef.current.map((attachment) => ({
                path: attachment.path,
                name: attachment.name,
              }));
              if ((!content && attachments.length === 0) || !state.activeDmId) return;
              const channelId = state.activeDmId;
              const draftBuffer = bufferRef.current;
              const draftAttachments = pendingAttachmentsRef.current;
              replaceBuffer("");
              replacePendingAttachments([]);
              setMode("normal");
              store.dispatch({ type: "sendError/set", message: null });
              sendDmMessage(client, { channelId, content, attachments }).catch((e) => {
                replaceBuffer(draftBuffer);
                replacePendingAttachments(draftAttachments);
                setMode("insert");
                store.dispatch({ type: "sendError/set", message: (e as Error).message });
              });
            }}
          />
        </Box>
      </Box>
      <Footer connection={state.connection} mode={mode} width={terminalSize.width} />
    </Box>
  );

  async function attachClipboardImage(): Promise<void> {
    const clipboardText = await readClipboardText().catch(() => "");
    if (clipboardText.trim().length > 0) {
      const consumed = consumeImageAttachmentInput(clipboardText, "");
      if (consumed && consumed.attachments.length > 0) {
        appendPendingAttachments(consumed.attachments);
        store.dispatch({ type: "sendError/set", message: null });
        return;
      }
    }

    const clipboardPaths = await readClipboardImagePaths();
    const attachments = resolvePendingAttachments(clipboardPaths);
    if (attachments.length === 0) {
      throw new Error("clipboard does not contain an image file or bitmap image");
    }
    appendPendingAttachments(attachments);
    store.dispatch({ type: "sendError/set", message: null });
  }

  function replaceBuffer(nextBuffer: string): void {
    bufferRef.current = nextBuffer;
    setBuffer(nextBuffer);
  }

  function replacePendingAttachments(nextAttachments: PendingAttachment[]): void {
    pendingAttachmentsRef.current = nextAttachments;
    setPendingAttachments(nextAttachments);
  }

  function appendPendingAttachments(nextAttachments: PendingAttachment[]): void {
    replacePendingAttachments(
      mergeAttachments(pendingAttachmentsRef.current, nextAttachments),
    );
  }
}

export async function runTui(): Promise<void> {
  const store = createStore();
  const session = await createSession({
    isShell: false,
    outputMode: "text",
  });
  const client = session.context.client!;

  store.dispatch({ type: "connection/set", status: "connected" });
  store.dispatch({ type: "dms/upsertMany", dms: session.context.dms });

  client.on("connectionChange", (status) =>
    store.dispatch({ type: "connection/set", status }),
  );
  client.on("ready", () => store.dispatch({ type: "connection/set", status: "connected" }));
  client.on("dms", (dms) => {
    session.context.dms = dms;
    store.dispatch({ type: "dms/upsertMany", dms });
  });
  client.on("message", (message) => {
    store.dispatch({ type: "messages/appendLive", message });
    if (store.getState().activeDmId !== message.channelId) {
      store.dispatch({ type: "dms/markUnread", dmId: message.channelId });
    }
  });

  inkRender(
    <App
      store={store}
      client={client}
      onExit={() => session.close().catch((e) => logError("discord.client.close", e))}
    />,
  );
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
  const messageRows = Math.max(0, height - 4 - loadingRows - pendingRows);
  return {
    contentWidth,
    messageRows,
  };
}

function mergeAttachments(
  current: PendingAttachment[],
  incoming: PendingAttachment[],
): PendingAttachment[] {
  const seen = new Set(current.map((attachment) => attachment.path));
  const next = [...current];
  for (const attachment of incoming) {
    if (seen.has(attachment.path)) continue;
    seen.add(attachment.path);
    next.push(attachment);
  }
  return next;
}
