export interface Attachment {
  id: string;
  name: string;
  url: string;
  contentType: string | null;
  size: number;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
  attachments: Attachment[];
}

export interface DM {
  id: string;
  name: string;
  isGroup: boolean;
  memberCount: number;
  lastActivityAt: number;
  unread: boolean;
}

export interface ConversationView {
  messages: Message[];
  oldestFetchedId: string | null;
  reachedBeginning: boolean;
  loadingOlder: boolean;
  scrollOffsetFromBottom: number;
  pendingNewCount: number;
}

export interface State {
  dms: Record<string, DM>;
  conversations: Record<string, ConversationView>;
  activeDmId: string | null;
  focus: "list" | "conversation";
  connection: "connecting" | "connected" | "reconnecting";
  filter: string;
  sendError: string | null;
}

export const initialState: State = {
  dms: {},
  conversations: {},
  activeDmId: null,
  focus: "list",
  connection: "connecting",
  filter: "",
  sendError: null,
};

export type Action =
  | { type: "connection/set"; status: State["connection"] }
  | { type: "dms/upsertMany"; dms: DM[] }
  | { type: "dms/markUnread"; dmId: string }
  | { type: "dms/clearUnread"; dmId: string }
  | { type: "active/set"; dmId: string | null }
  | { type: "focus/set"; focus: State["focus"] }
  | { type: "filter/set"; value: string }
  | { type: "messages/appendLive"; message: Message }
  | { type: "messages/appendHistory"; channelId: string; messages: Message[] }
  | { type: "messages/prependHistory"; channelId: string; messages: Message[]; reachedBeginning: boolean }
  | { type: "messages/setLoadingOlder"; channelId: string; loading: boolean }
  | { type: "scroll/set"; channelId: string; offsetFromBottom: number }
  | { type: "scroll/consumePending"; channelId: string }
  | { type: "sendError/set"; message: string | null };
