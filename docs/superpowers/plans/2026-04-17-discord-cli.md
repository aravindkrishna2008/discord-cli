# discord-cli Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A terminal Discord client (`discord-cli`) for direct messages — 1:1 and group DMs — with Playwright-driven login, two-pane Ink TUI, live gateway updates, send/receive text, and inline rendering of received images.

**Architecture:** Node.js + TypeScript. `discord.js-selfbot-v13` owns Discord I/O; Ink (React for terminals) owns rendering; a pure in-memory store is the single source of truth both sides use. Playwright drives the Discord login page and extracts the user token from IndexedDB/localStorage.

**Tech Stack:** Node 20+, TypeScript, Ink, `discord.js-selfbot-v13`, `playwright`, `terminal-image`, `commander`, `vitest`, `ink-testing-library`.

**Spec:** `docs/superpowers/specs/2026-04-17-discord-cli-design.md`

---

## File layout produced by this plan

```
bin/
  discord-cli.ts                      CLI entrypoint (compiled to dist/bin/discord-cli.js)

src/
  index.ts                            barrel re-exports for tests
  config/
    config.ts                         Config type, defaults, load/save
    paths.ts                          ~/.discord-cli paths
  auth/
    store.ts                          read/write/delete auth.json with chmod 600
    playwright-login.ts               headed Chromium flow → token
    manual-login.ts                   prompt-based token paste fallback
  discord/
    client.ts                         wrapper: login, ready, fetch DMs, send, history
    events.ts                         narrow gateway events to typed callbacks
    types.ts                          DM, Message, Attachment shapes used by the store
  store/
    types.ts                          State + Action types
    reducer.ts                        pure reducer
    selectors.ts                      derived views (sorted DM list, active messages)
    store.ts                          tiny subscribe/dispatch wrapper
  tui/
    App.tsx                           root Ink component
    DMList.tsx                        left pane
    Conversation.tsx                  right pane (messages)
    Input.tsx                         message input (modes)
    Footer.tsx                        status + keybind hints
    ImageView.tsx                     inline image render
    keybinds.ts                       normal + insert mode key dispatch
    mode.ts                           mode state hook
    useStore.ts                       Ink-friendly subscription hook
  image/
    protocol.ts                       detect iterm/kitty/halfblock
    render.ts                         wrap terminal-image with protocol choice + fallback
  errors/
    logger.ts                         append to ~/.discord-cli/error.log
    fatal.ts                          process-level uncaught handler

tests/
  config.test.ts
  auth/store.test.ts
  store/reducer.test.ts
  store/selectors.test.ts
  discord/events.test.ts
  image/protocol.test.ts
  tui/DMList.test.tsx
  tui/Conversation.test.tsx
  tui/Input.test.tsx
  tui/App.test.tsx

docs/qa.md                            manual QA checklist
```

Each task below produces a focused, commit-sized change.

---

## Task 1: Project scaffold (TypeScript, vitest, Ink deps)

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts` (empty barrel)

- [ ] **Step 1: Replace package.json**

Overwrite `package.json`:

```json
{
  "name": "discord-cli",
  "version": "0.1.0",
  "description": "Terminal Discord client for DMs",
  "license": "MIT",
  "type": "module",
  "bin": {
    "discord-cli": "dist/bin/discord-cli.js"
  },
  "scripts": {
    "build": "tsc -p .",
    "dev": "tsx bin/discord-cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p . --noEmit"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "discord.js-selfbot-v13": "^3.5.0",
    "ink": "^5.0.1",
    "ink-text-input": "^6.0.0",
    "playwright": "^1.49.0",
    "react": "^18.3.1",
    "terminal-image": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.3",
    "ink-testing-library": "^4.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src", "bin", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules
dist
*.log
.DS_Store
```

- [ ] **Step 5: Create empty barrel src/index.ts**

```ts
export {};
```

- [ ] **Step 6: Install**

Run: `npm install`
Expected: exit 0, creates `node_modules`. Playwright post-install may print a hint about `npx playwright install chromium` — fine; we handle that at runtime.

- [ ] **Step 7: Verify typecheck passes on an empty project**

Run: `npm run typecheck`
Expected: exit 0, no output.

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold TypeScript + Ink + vitest project"
```

---

## Task 2: Config paths

**Files:**
- Create: `src/config/paths.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing test**

`tests/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { paths } from "../src/config/paths.js";
import { homedir } from "node:os";
import { join } from "node:path";

describe("paths", () => {
  it("puts everything under ~/.discord-cli", () => {
    const root = join(homedir(), ".discord-cli");
    expect(paths.root).toBe(root);
    expect(paths.authFile).toBe(join(root, "auth.json"));
    expect(paths.configFile).toBe(join(root, "config.json"));
    expect(paths.errorLog).toBe(join(root, "error.log"));
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `npm test -- tests/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement paths**

`src/config/paths.ts`:

```ts
import { homedir } from "node:os";
import { join } from "node:path";

const root = join(homedir(), ".discord-cli");

export const paths = {
  root,
  authFile: join(root, "auth.json"),
  configFile: join(root, "config.json"),
  errorLog: join(root, "error.log"),
};
```

- [ ] **Step 4: Run test, expect pass**

Run: `npm test -- tests/config.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/config/paths.ts tests/config.test.ts
git commit -m "feat(config): define ~/.discord-cli paths"
```

---

## Task 3: Config load/save with defaults

**Files:**
- Create: `src/config/config.ts`
- Modify: `tests/config.test.ts`

- [ ] **Step 1: Add failing tests to tests/config.test.ts**

Append:

```ts
import { describe as describe2, it as it2, expect as expect2, beforeEach } from "vitest";
import { loadConfig, saveConfig, defaultConfig } from "../src/config/config.js";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";

describe2("config", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(pjoin(tmpdir(), "dcli-"));
  });

  it2("returns defaults when file missing", () => {
    const cfg = loadConfig(pjoin(dir, "config.json"));
    expect2(cfg).toEqual(defaultConfig);
  });

  it2("merges partial config onto defaults", () => {
    writeFileSync(pjoin(dir, "config.json"), JSON.stringify({ imageProtocol: "kitty" }));
    const cfg = loadConfig(pjoin(dir, "config.json"));
    expect2(cfg.imageProtocol).toBe("kitty");
    expect2(cfg.initialHistory).toBe(defaultConfig.initialHistory);
  });

  it2("save writes JSON and creates directory", () => {
    const file = pjoin(dir, "nested", "config.json");
    saveConfig(file, { ...defaultConfig, initialHistory: 25 });
    expect2(existsSync(file)).toBe(true);
    const round = JSON.parse(readFileSync(file, "utf8"));
    expect2(round.initialHistory).toBe(25);
  });

  it2("returns defaults on malformed JSON (does not throw)", () => {
    writeFileSync(pjoin(dir, "config.json"), "{ not json");
    const cfg = loadConfig(pjoin(dir, "config.json"));
    expect2(cfg).toEqual(defaultConfig);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- tests/config.test.ts`
Expected: FAIL — module `../src/config/config.js` not found.

- [ ] **Step 3: Implement config module**

`src/config/config.ts`:

```ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export type ImageProtocol = "auto" | "iterm" | "kitty" | "halfblock" | "none";

export interface Config {
  imageProtocol: ImageProtocol;
  initialHistory: number;
  theme: { unread: string; author: string; time: string };
}

export const defaultConfig: Config = {
  imageProtocol: "auto",
  initialHistory: 50,
  theme: { unread: "yellow", author: "cyan", time: "gray" },
};

export function loadConfig(file: string): Config {
  if (!existsSync(file)) return defaultConfig;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return {
      ...defaultConfig,
      ...raw,
      theme: { ...defaultConfig.theme, ...(raw.theme ?? {}) },
    };
  } catch {
    return defaultConfig;
  }
}

export function saveConfig(file: string, cfg: Config): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/config.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/config/config.ts tests/config.test.ts
git commit -m "feat(config): load/save with defaults and partial merge"
```

---

## Task 4: Auth storage (token file with chmod 600)

**Files:**
- Create: `src/auth/store.ts`
- Create: `tests/auth/store.test.ts`

- [ ] **Step 1: Write failing test**

`tests/auth/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { writeAuth, readAuth, clearAuth } from "../../src/auth/store.js";
import { mkdtempSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("auth store", () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "dcli-auth-"));
    file = join(dir, "auth.json");
  });

  it("read returns null when missing", () => {
    expect(readAuth(file)).toBeNull();
  });

  it("write then read round-trips", () => {
    writeAuth(file, { token: "abc", username: "alice", createdAt: 123 });
    expect(readAuth(file)).toEqual({ token: "abc", username: "alice", createdAt: 123 });
  });

  it("write sets file mode 0o600 on POSIX", () => {
    writeAuth(file, { token: "abc", username: "u", createdAt: 1 });
    if (process.platform !== "win32") {
      const mode = statSync(file).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it("clear removes the file", () => {
    writeAuth(file, { token: "abc", username: "u", createdAt: 1 });
    clearAuth(file);
    expect(existsSync(file)).toBe(false);
  });

  it("clear is idempotent", () => {
    expect(() => clearAuth(file)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- tests/auth/store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/auth/store.ts`:

```ts
import { readFileSync, writeFileSync, chmodSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname } from "node:path";

export interface AuthRecord {
  token: string;
  username: string;
  createdAt: number;
}

export function readAuth(file: string): AuthRecord | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as AuthRecord;
  } catch {
    return null;
  }
}

export function writeAuth(file: string, record: AuthRecord): void {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(record, null, 2) + "\n", { mode: 0o600 });
  if (process.platform !== "win32") chmodSync(file, 0o600);
}

export function clearAuth(file: string): void {
  if (existsSync(file)) rmSync(file);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/auth/store.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/auth/store.ts tests/auth/store.test.ts
git commit -m "feat(auth): token file read/write/clear with chmod 600"
```

---

## Task 5: Store types and empty state

**Files:**
- Create: `src/store/types.ts`

- [ ] **Step 1: Write the types (no test yet — types used by subsequent tasks)**

`src/store/types.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/store/types.ts
git commit -m "feat(store): State, Action, and domain types"
```

---

## Task 6: Reducer — connection, dms upsert, active/focus/filter

**Files:**
- Create: `src/store/reducer.ts`
- Create: `tests/store/reducer.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/store/reducer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reduce } from "../../src/store/reducer.js";
import { initialState, type DM, type Message } from "../../src/store/types.js";

const dm = (over: Partial<DM> = {}): DM => ({
  id: "1",
  name: "alice",
  isGroup: false,
  memberCount: 1,
  lastActivityAt: 0,
  unread: false,
  ...over,
});

describe("reducer — connection/dms/active", () => {
  it("sets connection status", () => {
    const s = reduce(initialState, { type: "connection/set", status: "connected" });
    expect(s.connection).toBe("connected");
  });

  it("upserts DMs by id (preserves existing unread)", () => {
    let s = reduce(initialState, { type: "dms/upsertMany", dms: [dm({ id: "1" })] });
    s = reduce(s, { type: "dms/markUnread", dmId: "1" });
    s = reduce(s, { type: "dms/upsertMany", dms: [dm({ id: "1", name: "alice-renamed" })] });
    expect(s.dms["1"].name).toBe("alice-renamed");
    expect(s.dms["1"].unread).toBe(true);
  });

  it("active/set clears unread on the newly active DM", () => {
    let s = reduce(initialState, { type: "dms/upsertMany", dms: [dm({ id: "1" })] });
    s = reduce(s, { type: "dms/markUnread", dmId: "1" });
    s = reduce(s, { type: "active/set", dmId: "1" });
    expect(s.activeDmId).toBe("1");
    expect(s.dms["1"].unread).toBe(false);
  });

  it("markUnread no-ops when DM is the active one", () => {
    let s = reduce(initialState, { type: "dms/upsertMany", dms: [dm({ id: "1" })] });
    s = reduce(s, { type: "active/set", dmId: "1" });
    s = reduce(s, { type: "dms/markUnread", dmId: "1" });
    expect(s.dms["1"].unread).toBe(false);
  });

  it("focus/set and filter/set update scalars", () => {
    let s = reduce(initialState, { type: "focus/set", focus: "conversation" });
    expect(s.focus).toBe("conversation");
    s = reduce(s, { type: "filter/set", value: "al" });
    expect(s.filter).toBe("al");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- tests/store/reducer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement reducer (this slice only)**

`src/store/reducer.ts`:

```ts
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
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/store/reducer.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/store/reducer.ts tests/store/reducer.test.ts
git commit -m "feat(store): reducer for connection, DMs, active, focus, filter"
```

---

## Task 7: Reducer — messages (live append, history pages, scroll-aware)

**Files:**
- Modify: `src/store/reducer.ts`
- Modify: `tests/store/reducer.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/store/reducer.test.ts`:

```ts
const msg = (over: Partial<Message> & { id: string }): Message => ({
  channelId: "1",
  authorId: "u",
  authorName: "alice",
  content: "hi",
  createdAt: 0,
  attachments: [],
  ...over,
});

describe("reducer — messages", () => {
  it("appendLive creates a conversation if none exists", () => {
    const s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    expect(s.conversations["1"].messages).toHaveLength(1);
    expect(s.conversations["1"].messages[0].id).toBe("m1");
  });

  it("appendLive dedupes by id", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    s = reduce(s, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    expect(s.conversations["1"].messages).toHaveLength(1);
  });

  it("appendLive increments pendingNewCount when scrolled up", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    s = reduce(s, { type: "scroll/set", channelId: "1", offsetFromBottom: 10 });
    s = reduce(s, { type: "messages/appendLive", message: msg({ id: "m2" }) });
    expect(s.conversations["1"].pendingNewCount).toBe(1);
  });

  it("appendLive leaves pendingNewCount at 0 when at bottom", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    s = reduce(s, { type: "messages/appendLive", message: msg({ id: "m2" }) });
    expect(s.conversations["1"].pendingNewCount).toBe(0);
  });

  it("prependHistory adds older messages and updates oldestFetchedId", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m5" }) });
    s = reduce(s, {
      type: "messages/prependHistory",
      channelId: "1",
      messages: [msg({ id: "m1" }), msg({ id: "m2" })],
      reachedBeginning: false,
    });
    expect(s.conversations["1"].messages.map((m) => m.id)).toEqual(["m1", "m2", "m5"]);
    expect(s.conversations["1"].oldestFetchedId).toBe("m1");
    expect(s.conversations["1"].reachedBeginning).toBe(false);
  });

  it("prependHistory marks reachedBeginning when fewer than requested return", () => {
    const s = reduce(initialState, {
      type: "messages/prependHistory",
      channelId: "1",
      messages: [msg({ id: "m1" })],
      reachedBeginning: true,
    });
    expect(s.conversations["1"].reachedBeginning).toBe(true);
  });

  it("appendHistory seeds a conversation from initial fetch", () => {
    const s = reduce(initialState, {
      type: "messages/appendHistory",
      channelId: "1",
      messages: [msg({ id: "m1" }), msg({ id: "m2" })],
    });
    expect(s.conversations["1"].messages).toHaveLength(2);
    expect(s.conversations["1"].oldestFetchedId).toBe("m1");
  });

  it("scroll/consumePending resets counter", () => {
    let s = reduce(initialState, { type: "messages/appendLive", message: msg({ id: "m1" }) });
    s = reduce(s, { type: "scroll/set", channelId: "1", offsetFromBottom: 5 });
    s = reduce(s, { type: "messages/appendLive", message: msg({ id: "m2" }) });
    s = reduce(s, { type: "scroll/consumePending", channelId: "1" });
    expect(s.conversations["1"].pendingNewCount).toBe(0);
  });

  it("setLoadingOlder toggles the flag", () => {
    let s = reduce(initialState, { type: "messages/setLoadingOlder", channelId: "1", loading: true });
    expect(s.conversations["1"].loadingOlder).toBe(true);
    s = reduce(s, { type: "messages/setLoadingOlder", channelId: "1", loading: false });
    expect(s.conversations["1"].loadingOlder).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect failures**

Run: `npm test -- tests/store/reducer.test.ts`
Expected: FAIL — new cases unhandled.

- [ ] **Step 3: Extend reducer**

Add a helper above `reduce` in `src/store/reducer.ts`:

```ts
import type { ConversationView, Message } from "./types.js";

function ensureConversation(state: State, channelId: string): ConversationView {
  return (
    state.conversations[channelId] ?? {
      messages: [],
      oldestFetchedId: null,
      reachedBeginning: false,
      loadingOlder: false,
      scrollOffsetFromBottom: 0,
      pendingNewCount: 0,
    }
  );
}

function setConversation(state: State, channelId: string, conv: ConversationView): State {
  return { ...state, conversations: { ...state.conversations, [channelId]: conv } };
}

function sortByCreatedAt(msgs: Message[]): Message[] {
  return [...msgs].sort((a, b) => a.createdAt - b.createdAt);
}
```

Add these cases inside the `switch`:

```ts
    case "messages/appendLive": {
      const conv = ensureConversation(state, action.message.channelId);
      if (conv.messages.some((m) => m.id === action.message.id)) return state;
      const messages = [...conv.messages, action.message];
      const scrolledUp = conv.scrollOffsetFromBottom > 0;
      return setConversation(state, action.message.channelId, {
        ...conv,
        messages,
        pendingNewCount: scrolledUp ? conv.pendingNewCount + 1 : 0,
      });
    }

    case "messages/appendHistory": {
      const conv = ensureConversation(state, action.channelId);
      const merged = sortByCreatedAt([
        ...conv.messages,
        ...action.messages.filter((m) => !conv.messages.some((c) => c.id === m.id)),
      ]);
      return setConversation(state, action.channelId, {
        ...conv,
        messages: merged,
        oldestFetchedId: merged[0]?.id ?? null,
      });
    }

    case "messages/prependHistory": {
      const conv = ensureConversation(state, action.channelId);
      const older = action.messages.filter((m) => !conv.messages.some((c) => c.id === m.id));
      const merged = sortByCreatedAt([...older, ...conv.messages]);
      return setConversation(state, action.channelId, {
        ...conv,
        messages: merged,
        oldestFetchedId: merged[0]?.id ?? conv.oldestFetchedId,
        reachedBeginning: action.reachedBeginning,
        loadingOlder: false,
      });
    }

    case "messages/setLoadingOlder": {
      const conv = ensureConversation(state, action.channelId);
      return setConversation(state, action.channelId, { ...conv, loadingOlder: action.loading });
    }

    case "scroll/set": {
      const conv = ensureConversation(state, action.channelId);
      const pendingNewCount = action.offsetFromBottom === 0 ? 0 : conv.pendingNewCount;
      return setConversation(state, action.channelId, {
        ...conv,
        scrollOffsetFromBottom: action.offsetFromBottom,
        pendingNewCount,
      });
    }

    case "scroll/consumePending": {
      const conv = ensureConversation(state, action.channelId);
      return setConversation(state, action.channelId, { ...conv, pendingNewCount: 0 });
    }
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/store/reducer.test.ts`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add src/store/reducer.ts tests/store/reducer.test.ts
git commit -m "feat(store): message append/history/scroll reducer cases"
```

---

## Task 8: Selectors (sorted DM list with filter, active conversation)

**Files:**
- Create: `src/store/selectors.ts`
- Create: `tests/store/selectors.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/store/selectors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectDmList, selectActiveConversation } from "../../src/store/selectors.js";
import { initialState, type State, type DM } from "../../src/store/types.js";

const mk = (s: Partial<State>): State => ({ ...initialState, ...s });
const dm = (id: string, name: string, when: number, unread = false): DM => ({
  id,
  name,
  isGroup: false,
  memberCount: 1,
  lastActivityAt: when,
  unread,
});

describe("selectDmList", () => {
  it("sorts unread first, then by recency desc", () => {
    const state = mk({
      dms: {
        a: dm("a", "alice", 100, false),
        b: dm("b", "bob", 200, true),
        c: dm("c", "carol", 150, false),
      },
    });
    expect(selectDmList(state).map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("filters by case-insensitive substring", () => {
    const state = mk({
      dms: { a: dm("a", "Alice", 1), b: dm("b", "Bob", 2) },
      filter: "ali",
    });
    expect(selectDmList(state).map((d) => d.id)).toEqual(["a"]);
  });
});

describe("selectActiveConversation", () => {
  it("returns null when no active DM", () => {
    expect(selectActiveConversation(initialState)).toBeNull();
  });

  it("returns the conversation when active", () => {
    const state = mk({
      activeDmId: "1",
      conversations: {
        "1": {
          messages: [],
          oldestFetchedId: null,
          reachedBeginning: false,
          loadingOlder: false,
          scrollOffsetFromBottom: 0,
          pendingNewCount: 0,
        },
      },
    });
    expect(selectActiveConversation(state)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- tests/store/selectors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/store/selectors.ts`:

```ts
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
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/store/selectors.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/store/selectors.ts tests/store/selectors.test.ts
git commit -m "feat(store): DM list and active conversation selectors"
```

---

## Task 9: Store subscribe/dispatch wrapper

**Files:**
- Create: `src/store/store.ts`

- [ ] **Step 1: Implement the tiny store**

`src/store/store.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/store/store.ts
git commit -m "feat(store): subscribe/dispatch wrapper"
```

---

## Task 10: Discord wrapper — types & event narrowing

**Files:**
- Create: `src/discord/types.ts`
- Create: `src/discord/events.ts`
- Create: `tests/discord/events.test.ts`

- [ ] **Step 1: Add types**

`src/discord/types.ts`:

```ts
export type { Attachment, Message, DM } from "../store/types.js";

export interface RawAttachment {
  id: string;
  name: string | null;
  url: string;
  contentType: string | null;
  size: number;
}

export interface RawMessage {
  id: string;
  channelId: string;
  author: { id: string; username: string; globalName?: string | null };
  content: string;
  createdTimestamp: number;
  attachments: { values(): Iterable<RawAttachment> } | RawAttachment[];
}

export interface RawChannel {
  id: string;
  type: string; // "DM" | "GROUP_DM"
  name: string | null;
  recipient?: { username: string; globalName?: string | null };
  recipients?: { size: number };
  lastMessageId?: string | null;
  // timestamps from discord.js-selfbot are exposed via getters; keep optional
  lastMessageTimestamp?: number | null;
}
```

- [ ] **Step 2: Write failing tests**

`tests/discord/events.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeMessage, normalizeChannel } from "../../src/discord/events.js";

describe("normalizeMessage", () => {
  it("maps raw selfbot message to store Message (array attachments)", () => {
    const out = normalizeMessage({
      id: "m1",
      channelId: "c1",
      author: { id: "u1", username: "alice", globalName: "Alice" },
      content: "hi",
      createdTimestamp: 1000,
      attachments: [
        { id: "a1", name: "pic.png", url: "https://x", contentType: "image/png", size: 10 },
      ],
    });
    expect(out).toEqual({
      id: "m1",
      channelId: "c1",
      authorId: "u1",
      authorName: "Alice",
      content: "hi",
      createdAt: 1000,
      attachments: [
        { id: "a1", name: "pic.png", url: "https://x", contentType: "image/png", size: 10 },
      ],
    });
  });

  it("falls back to username when globalName is missing", () => {
    const out = normalizeMessage({
      id: "m1",
      channelId: "c1",
      author: { id: "u1", username: "alice" },
      content: "hi",
      createdTimestamp: 1,
      attachments: [],
    });
    expect(out.authorName).toBe("alice");
  });

  it("names unnamed attachments 'file'", () => {
    const out = normalizeMessage({
      id: "m1",
      channelId: "c1",
      author: { id: "u1", username: "alice" },
      content: "",
      createdTimestamp: 1,
      attachments: [{ id: "a1", name: null, url: "u", contentType: null, size: 0 }],
    });
    expect(out.attachments[0].name).toBe("file");
  });
});

describe("normalizeChannel", () => {
  it("names a 1:1 DM after the other recipient", () => {
    const dm = normalizeChannel({
      id: "c1",
      type: "DM",
      name: null,
      recipient: { username: "bob", globalName: "Bob" },
      lastMessageTimestamp: 42,
    });
    expect(dm).toEqual({
      id: "c1",
      name: "Bob",
      isGroup: false,
      memberCount: 1,
      lastActivityAt: 42,
      unread: false,
    });
  });

  it("uses the group's own name (or '(group)' if null) and member count", () => {
    const dm = normalizeChannel({
      id: "c2",
      type: "GROUP_DM",
      name: "study-group",
      recipients: { size: 3 },
    });
    expect(dm.isGroup).toBe(true);
    expect(dm.name).toBe("study-group");
    expect(dm.memberCount).toBe(3);
  });

  it("falls back to '(group)' when group has no name", () => {
    const dm = normalizeChannel({
      id: "c3",
      type: "GROUP_DM",
      name: null,
      recipients: { size: 4 },
    });
    expect(dm.name).toBe("(group)");
  });
});
```

- [ ] **Step 3: Run, expect failure**

Run: `npm test -- tests/discord/events.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/discord/events.ts`:

```ts
import type { DM, Message } from "../store/types.js";
import type { RawAttachment, RawChannel, RawMessage } from "./types.js";

function attachmentsArray(
  a: RawMessage["attachments"],
): RawAttachment[] {
  if (Array.isArray(a)) return a;
  return Array.from(a.values());
}

export function normalizeMessage(raw: RawMessage): Message {
  return {
    id: raw.id,
    channelId: raw.channelId,
    authorId: raw.author.id,
    authorName: raw.author.globalName ?? raw.author.username,
    content: raw.content,
    createdAt: raw.createdTimestamp,
    attachments: attachmentsArray(raw.attachments).map((a) => ({
      id: a.id,
      name: a.name ?? "file",
      url: a.url,
      contentType: a.contentType,
      size: a.size,
    })),
  };
}

export function normalizeChannel(raw: RawChannel): DM {
  const isGroup = raw.type === "GROUP_DM";
  const name = isGroup
    ? raw.name ?? "(group)"
    : raw.recipient?.globalName ?? raw.recipient?.username ?? "(unknown)";
  const memberCount = isGroup ? raw.recipients?.size ?? 0 : 1;
  return {
    id: raw.id,
    name,
    isGroup,
    memberCount,
    lastActivityAt: raw.lastMessageTimestamp ?? 0,
    unread: false,
  };
}
```

- [ ] **Step 5: Run, expect pass**

Run: `npm test -- tests/discord/events.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add src/discord/types.ts src/discord/events.ts tests/discord/events.test.ts
git commit -m "feat(discord): message/channel normalization"
```

---

## Task 11: Discord wrapper — client (login, ready, fetch DMs, send, history)

**Files:**
- Create: `src/discord/client.ts`

This wraps the selfbot library. It is thin and its public methods are all the TUI ever calls. Integration tested via the App tests (Task 21) by mocking this module; no direct unit tests — a live Discord test would risk the account.

- [ ] **Step 1: Implement**

`src/discord/client.ts`:

```ts
import { Client, type TextBasedChannel } from "discord.js-selfbot-v13";
import { normalizeChannel, normalizeMessage } from "./events.js";
import type { DM, Message } from "../store/types.js";
import type { RawChannel, RawMessage } from "./types.js";

export interface DiscordEvents {
  ready(me: { id: string; username: string }): void;
  dms(dms: DM[]): void;
  message(msg: Message): void;
  connectionChange(status: "connected" | "reconnecting"): void;
  error(e: Error): void;
}

export interface DiscordClient {
  login(token: string): Promise<void>;
  logout(): Promise<void>;
  fetchHistory(channelId: string, beforeId?: string, limit?: number): Promise<Message[]>;
  send(channelId: string, content: string): Promise<void>;
  on<K extends keyof DiscordEvents>(event: K, handler: DiscordEvents[K]): void;
}

export function createDiscordClient(): DiscordClient {
  const client = new Client({ checkUpdate: false });
  const handlers: Partial<DiscordEvents> = {};

  client.on("ready", () => {
    const me = { id: client.user!.id, username: client.user!.username };
    handlers.ready?.(me);

    const dmChannels: DM[] = [];
    for (const [, ch] of client.channels.cache) {
      const type = (ch as { type?: string }).type;
      if (type === "DM" || type === "GROUP_DM") {
        dmChannels.push(normalizeChannel(ch as unknown as RawChannel));
      }
    }
    handlers.dms?.(dmChannels);
    handlers.connectionChange?.("connected");
  });

  client.on("messageCreate", (m) => {
    const type = (m.channel as { type?: string }).type;
    if (type !== "DM" && type !== "GROUP_DM") return;
    handlers.message?.(normalizeMessage(m as unknown as RawMessage));
  });

  client.on("shardDisconnect", () => handlers.connectionChange?.("reconnecting"));
  client.on("shardResume", () => handlers.connectionChange?.("connected"));
  client.on("error", (e) => handlers.error?.(e));

  return {
    async login(token) {
      await client.login(token);
    },
    async logout() {
      await client.destroy();
    },
    async fetchHistory(channelId, beforeId, limit = 50) {
      const ch = (await client.channels.fetch(channelId)) as TextBasedChannel | null;
      if (!ch || !("messages" in ch)) return [];
      const opts: { limit: number; before?: string } = { limit };
      if (beforeId) opts.before = beforeId;
      const collection = await ch.messages.fetch(opts);
      const raws = Array.from(collection.values()) as unknown as RawMessage[];
      return raws.map(normalizeMessage);
    },
    async send(channelId, content) {
      const ch = (await client.channels.fetch(channelId)) as TextBasedChannel | null;
      if (!ch || !("send" in ch)) throw new Error(`channel ${channelId} not sendable`);
      await ch.send(content);
    },
    on(event, handler) {
      handlers[event] = handler as never;
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0. (If the library's published types surface differences in `fetch` option names, adjust the two `opts` sites only — do not change the public `DiscordClient` interface.)

- [ ] **Step 3: Commit**

```bash
git add src/discord/client.ts
git commit -m "feat(discord): thin selfbot client wrapper"
```

---

## Task 12: Image protocol detection

**Files:**
- Create: `src/image/protocol.ts`
- Create: `tests/image/protocol.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/image/protocol.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveProtocol } from "../../src/image/protocol.js";

describe("resolveProtocol", () => {
  it("returns explicit choice when not auto", () => {
    expect(resolveProtocol("kitty", {})).toBe("kitty");
    expect(resolveProtocol("none", {})).toBe("none");
  });

  it("auto picks iterm for iTerm.app", () => {
    expect(resolveProtocol("auto", { TERM_PROGRAM: "iTerm.app" })).toBe("iterm");
  });

  it("auto picks kitty for kitty terminal", () => {
    expect(resolveProtocol("auto", { TERM: "xterm-kitty" })).toBe("kitty");
  });

  it("auto falls back to halfblock", () => {
    expect(resolveProtocol("auto", { TERM: "xterm-256color" })).toBe("halfblock");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- tests/image/protocol.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/image/protocol.ts`:

```ts
import type { ImageProtocol } from "../config/config.js";

export type RenderProtocol = Exclude<ImageProtocol, "auto">;

export function resolveProtocol(
  choice: ImageProtocol,
  env: NodeJS.ProcessEnv,
): RenderProtocol {
  if (choice !== "auto") return choice;
  if (env.TERM_PROGRAM === "iTerm.app") return "iterm";
  if (env.TERM === "xterm-kitty" || env.KITTY_WINDOW_ID) return "kitty";
  return "halfblock";
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/image/protocol.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/image/protocol.ts tests/image/protocol.test.ts
git commit -m "feat(image): protocol detection from env"
```

---

## Task 13: Image renderer (wraps terminal-image with fallback)

**Files:**
- Create: `src/image/render.ts`

The actual rendering is IO + third-party; no unit test. The Conversation component test (Task 17) asserts the fallback placeholder when no renderer is provided.

- [ ] **Step 1: Implement**

`src/image/render.ts`:

```ts
import terminalImage from "terminal-image";
import type { RenderProtocol } from "./protocol.js";

export interface RenderOptions {
  protocol: RenderProtocol;
  maxWidth?: number;
  maxHeight?: number;
}

export async function renderImageFromUrl(url: string, opts: RenderOptions): Promise<string | null> {
  if (opts.protocol === "none") return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // terminal-image picks the protocol based on the terminal; our `opts.protocol`
    // is an explicit user override that matters only for "none" (bail above).
    // halfBlock is the portable default used by terminal-image.
    return await terminalImage.buffer(buf, {
      width: opts.maxWidth ?? 40,
      height: opts.maxHeight ?? 20,
      preserveAspectRatio: true,
    });
  } catch {
    return null;
  }
}

export function placeholderFor(name: string, size: number): string {
  return `[image: ${name} (${formatBytes(size)})]`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/image/render.ts
git commit -m "feat(image): render via terminal-image with placeholder fallback"
```

---

## Task 14: Error logger

**Files:**
- Create: `src/errors/logger.ts`
- Create: `src/errors/fatal.ts`

- [ ] **Step 1: Implement logger**

`src/errors/logger.ts`:

```ts
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { paths } from "../config/paths.js";

export function logError(prefix: string, err: unknown): void {
  try {
    mkdirSync(dirname(paths.errorLog), { recursive: true, mode: 0o700 });
    const line = `[${new Date().toISOString()}] ${prefix}: ${format(err)}\n`;
    appendFileSync(paths.errorLog, line, "utf8");
  } catch {
    // swallow — last line of defense
  }
}

function format(err: unknown): string {
  if (err instanceof Error) return `${err.message}\n${err.stack ?? ""}`;
  return JSON.stringify(err);
}
```

- [ ] **Step 2: Implement fatal handler**

`src/errors/fatal.ts`:

```ts
import { logError } from "./logger.js";
import { paths } from "../config/paths.js";

export function installFatalHandlers(onExit: (code: number) => void): void {
  process.on("uncaughtException", (e) => {
    logError("uncaughtException", e);
    process.stderr.write(`\nFatal error — see ${paths.errorLog}\n`);
    onExit(1);
  });
  process.on("unhandledRejection", (e) => {
    logError("unhandledRejection", e);
    process.stderr.write(`\nFatal error — see ${paths.errorLog}\n`);
    onExit(1);
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/errors
git commit -m "feat(errors): append to ~/.discord-cli/error.log on crash"
```

---

## Task 15: Manual login fallback (token paste)

**Files:**
- Create: `src/auth/manual-login.ts`

- [ ] **Step 1: Implement**

`src/auth/manual-login.ts`:

```ts
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function promptTokenPaste(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  try {
    stdout.write(
      "Automated login unavailable. Paste your Discord user token below.\n" +
        "(Open Discord in a browser → DevTools → Application → IndexedDB → cookieStorage → 'token')\n" +
        "Token: ",
    );
    const token = (await rl.question("")).trim();
    if (!token) throw new Error("no token provided");
    return token;
  } finally {
    rl.close();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/auth/manual-login.ts
git commit -m "feat(auth): manual token paste fallback"
```

---

## Task 16: Playwright login flow

**Files:**
- Create: `src/auth/playwright-login.ts`

Playwright itself is IO; no unit test. Verified via the manual QA checklist in Task 26.

- [ ] **Step 1: Implement**

`src/auth/playwright-login.ts`:

```ts
import { chromium, type Browser, type Page } from "playwright";

export interface LoginResult {
  token: string;
  username: string;
}

export async function loginViaBrowser(): Promise<LoginResult> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://discord.com/login");
    await page.waitForURL("https://discord.com/channels/@me", { timeout: 0 });
    const token = await extractToken(page);
    if (!token) throw new Error("could not extract token from browser session");
    const username = await page
      .evaluate(() => {
        // Best-effort: Discord exposes the current user via a localStorage entry.
        const raw = window.localStorage.getItem("user");
        if (!raw) return null;
        try {
          return (JSON.parse(raw) as { username?: string }).username ?? null;
        } catch {
          return null;
        }
      })
      .catch(() => null);
    return { token, username: username ?? "unknown" };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

async function extractToken(page: Page): Promise<string | null> {
  const viaLocal = await page.evaluate(() => {
    const t = window.localStorage.getItem("token");
    return typeof t === "string" ? t.replace(/^"|"$/g, "") : null;
  });
  if (viaLocal) return viaLocal;

  return await page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const req = indexedDB.open("cookieStorage");
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("cookies")) return resolve(null);
          const tx = db.transaction("cookies", "readonly");
          const getAll = tx.objectStore("cookies").getAll();
          getAll.onerror = () => resolve(null);
          getAll.onsuccess = () => {
            const row = (getAll.result as Array<{ name?: string; value?: string }>).find(
              (r) => r.name === "token",
            );
            resolve(row?.value ?? null);
          };
        };
      }),
  );
}

export async function chromiumAvailable(): Promise<boolean> {
  try {
    const b = await chromium.launch({ headless: true });
    await b.close();
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/auth/playwright-login.ts
git commit -m "feat(auth): Playwright-driven login + token extraction"
```

---

## Task 17: CLI entrypoint with commander (login/logout/default)

**Files:**
- Create: `bin/discord-cli.ts`

- [ ] **Step 1: Implement**

`bin/discord-cli.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { paths } from "../src/config/paths.js";
import { readAuth, writeAuth, clearAuth } from "../src/auth/store.js";
import { loginViaBrowser, chromiumAvailable } from "../src/auth/playwright-login.js";
import { promptTokenPaste } from "../src/auth/manual-login.js";
import { installFatalHandlers } from "../src/errors/fatal.js";
import { runTui } from "../src/tui/App.js";

installFatalHandlers((code) => process.exit(code));

const program = new Command();
program.name("discord-cli").description("Terminal Discord client for DMs").version("0.1.0");

program
  .command("login")
  .description("Log in via a browser (Playwright) or manual token paste")
  .option("--manual", "Skip Playwright and paste a token manually")
  .action(async (opts) => {
    let token: string;
    let username = "unknown";
    if (!opts.manual && (await chromiumAvailable())) {
      const res = await loginViaBrowser();
      token = res.token;
      username = res.username;
    } else {
      if (!opts.manual) {
        process.stdout.write(
          "Playwright/Chromium not available. Run 'npx playwright install chromium' or use --manual.\n",
        );
      }
      token = await promptTokenPaste();
    }
    writeAuth(paths.authFile, { token, username, createdAt: Date.now() });
    process.stdout.write(`\u2714 logged in as ${username}\n`);
  });

program
  .command("logout")
  .description("Delete the stored token")
  .action(() => {
    clearAuth(paths.authFile);
    process.stdout.write("logged out\n");
  });

program.action(async () => {
  const auth = readAuth(paths.authFile);
  if (!auth) {
    process.stderr.write("Not logged in. Run 'discord-cli login' first.\n");
    process.exit(1);
  }
  await runTui(auth.token);
});

program.parseAsync().catch((e) => {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0. (`runTui` is introduced in Task 22; expect a missing-export error until then — if so, stub the App export now:)

Stub `src/tui/App.tsx`:

```tsx
export async function runTui(_token: string): Promise<void> {
  throw new Error("TUI not yet implemented");
}
```

Then re-run `npm run typecheck` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add bin/discord-cli.ts src/tui/App.tsx
git commit -m "feat(cli): login/logout/default entrypoints"
```

---

## Task 18: TUI — DMList component

**Files:**
- Modify: `src/tui/App.tsx` (keep stub)
- Create: `src/tui/DMList.tsx`
- Create: `tests/tui/DMList.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/tui/DMList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { DMList } from "../../src/tui/DMList.js";
import type { DM } from "../../src/store/types.js";

const dm = (over: Partial<DM> & { id: string; name: string }): DM => ({
  id: over.id,
  name: over.name,
  isGroup: false,
  memberCount: 1,
  lastActivityAt: 0,
  unread: false,
  ...over,
});

describe("DMList", () => {
  it("renders each DM's name", () => {
    const { lastFrame } = render(
      <DMList
        items={[dm({ id: "1", name: "alice" }), dm({ id: "2", name: "bob" })]}
        selectedId="1"
        focused
        filter=""
      />,
    );
    expect(lastFrame()).toContain("alice");
    expect(lastFrame()).toContain("bob");
  });

  it("shows bullet for unread DMs", () => {
    const { lastFrame } = render(
      <DMList
        items={[dm({ id: "1", name: "alice", unread: true })]}
        selectedId={null}
        focused
        filter=""
      />,
    );
    expect(lastFrame()).toContain("\u25CF");
  });

  it("shows (N) for group DMs", () => {
    const { lastFrame } = render(
      <DMList
        items={[dm({ id: "2", name: "study-group", isGroup: true, memberCount: 3 })]}
        selectedId={null}
        focused
        filter=""
      />,
    );
    expect(lastFrame()).toContain("study-group");
    expect(lastFrame()).toContain("(3)");
  });

  it("shows filter prompt when filter is non-empty", () => {
    const { lastFrame } = render(
      <DMList items={[]} selectedId={null} focused filter="ali" />,
    );
    expect(lastFrame()).toContain("/ali");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- tests/tui/DMList.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/tui/DMList.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { DM } from "../store/types.js";

interface Props {
  items: DM[];
  selectedId: string | null;
  focused: boolean;
  filter: string;
}

export function DMList({ items, selectedId, focused, filter }: Props) {
  return (
    <Box flexDirection="column" width={30} borderStyle={focused ? "single" : "round"} paddingX={1}>
      <Text bold>DMs</Text>
      {filter ? <Text color="gray">/{filter}</Text> : null}
      {items.map((dm) => {
        const isSelected = dm.id === selectedId;
        const marker = dm.unread ? "\u25CF" : " ";
        const label = dm.isGroup ? `${dm.name} (${dm.memberCount})` : dm.name;
        return (
          <Text
            key={dm.id}
            color={dm.unread ? "yellow" : undefined}
            inverse={isSelected && focused}
          >
            {marker} {label}
          </Text>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/tui/DMList.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/tui/DMList.tsx tests/tui/DMList.test.tsx
git commit -m "feat(tui): DMList component"
```

---

## Task 19: TUI — Conversation component

**Files:**
- Create: `src/tui/Conversation.tsx`
- Create: `tests/tui/Conversation.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/tui/Conversation.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Conversation } from "../../src/tui/Conversation.js";
import type { ConversationView, Message } from "../../src/store/types.js";

const msg = (over: Partial<Message> & { id: string }): Message => ({
  channelId: "c",
  authorId: "u1",
  authorName: "alice",
  content: "hi",
  createdAt: Date.UTC(2026, 0, 1, 14, 22),
  attachments: [],
  ...over,
});

const view = (messages: Message[], extra: Partial<ConversationView> = {}): ConversationView => ({
  messages,
  oldestFetchedId: messages[0]?.id ?? null,
  reachedBeginning: false,
  loadingOlder: false,
  scrollOffsetFromBottom: 0,
  pendingNewCount: 0,
  ...extra,
});

describe("Conversation", () => {
  it("renders empty-state text", () => {
    const { lastFrame } = render(<Conversation view={null} title="alice" focused />);
    expect(lastFrame()).toContain("no messages");
  });

  it("renders author, time, and content", () => {
    const { lastFrame } = render(
      <Conversation view={view([msg({ id: "m1", content: "hey" })])} title="alice" focused />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain("alice");
    expect(frame).toContain("14:22");
    expect(frame).toContain("hey");
  });

  it("renders image attachment placeholder", () => {
    const m = msg({
      id: "m1",
      attachments: [
        { id: "a", name: "pic.png", url: "u", contentType: "image/png", size: 2048 },
      ],
    });
    const { lastFrame } = render(<Conversation view={view([m])} title="alice" focused />);
    expect(lastFrame()).toContain("[image: pic.png");
  });

  it("shows 'loading older messages' indicator when fetching", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([msg({ id: "m1" })], { loadingOlder: true })}
        title="alice"
        focused
      />,
    );
    expect(lastFrame()).toContain("loading older messages");
  });

  it("shows 'N new messages' jump indicator when scrolled up with pending", () => {
    const { lastFrame } = render(
      <Conversation
        view={view([msg({ id: "m1" })], { scrollOffsetFromBottom: 5, pendingNewCount: 2 })}
        title="alice"
        focused
      />,
    );
    expect(lastFrame()).toContain("2 new messages");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- tests/tui/Conversation.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/tui/Conversation.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ConversationView, Message, Attachment } from "../store/types.js";
import { placeholderFor } from "../image/render.js";

interface Props {
  view: ConversationView | null;
  title: string;
  focused: boolean;
}

export function Conversation({ view, title, focused }: Props) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle={focused ? "single" : "round"}
      paddingX={1}
    >
      <Text bold>#{title}</Text>
      <Text>{"─".repeat(30)}</Text>
      {view?.loadingOlder ? <Text color="gray">… loading older messages</Text> : null}
      {!view || view.messages.length === 0 ? (
        <Text color="gray">no messages</Text>
      ) : (
        view.messages.map((m) => <MessageLine key={m.id} m={m} />)
      )}
      {view && view.scrollOffsetFromBottom > 0 && view.pendingNewCount > 0 ? (
        <Text color="cyan">↓ {view.pendingNewCount} new messages</Text>
      ) : null}
    </Box>
  );
}

function MessageLine({ m }: { m: Message }) {
  const time = new Date(m.createdAt).toISOString().slice(11, 16);
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">{m.authorName}</Text> <Text color="gray">{time}</Text>
      </Text>
      {m.content ? <Text>  {m.content}</Text> : null}
      {m.attachments.map((a) => (
        <AttachmentLine key={a.id} a={a} />
      ))}
    </Box>
  );
}

function AttachmentLine({ a }: { a: Attachment }) {
  return <Text color="gray">  {placeholderFor(a.name, a.size)}</Text>;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/tui/Conversation.test.tsx`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/tui/Conversation.tsx tests/tui/Conversation.test.tsx
git commit -m "feat(tui): Conversation component (messages + placeholders)"
```

---

## Task 20: TUI — Input component (two modes)

**Files:**
- Create: `src/tui/Input.tsx`
- Create: `tests/tui/Input.test.tsx`

- [ ] **Step 1: Write failing test**

`tests/tui/Input.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Input } from "../../src/tui/Input.js";

describe("Input", () => {
  it("shows prompt placeholder in normal mode", () => {
    const { lastFrame } = render(
      <Input mode="normal" value="" sendError={null} onChange={() => {}} onSubmit={() => {}} />,
    );
    expect(lastFrame()).toContain("press i to type");
  });

  it("shows the buffer and prompt in insert mode", () => {
    const { lastFrame } = render(
      <Input
        mode="insert"
        value="hello"
        sendError={null}
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(lastFrame()).toContain("hello");
  });

  it("renders the send error below input", () => {
    const { lastFrame } = render(
      <Input
        mode="insert"
        value=""
        sendError="nope"
        onChange={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(lastFrame()).toContain("nope");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- tests/tui/Input.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/tui/Input.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface Props {
  mode: "normal" | "insert";
  value: string;
  sendError: string | null;
  onChange(v: string): void;
  onSubmit(): void;
}

export function Input({ mode, value, sendError, onChange, onSubmit }: Props) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray">{">"} </Text>
        {mode === "insert" ? (
          <TextInput value={value} onChange={onChange} onSubmit={onSubmit} />
        ) : (
          <Text color="gray">press i to type</Text>
        )}
      </Box>
      {sendError ? <Text color="red">! {sendError}</Text> : null}
    </Box>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- tests/tui/Input.test.tsx`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/tui/Input.tsx tests/tui/Input.test.tsx
git commit -m "feat(tui): Input component with normal/insert modes"
```

---

## Task 21: TUI — Footer

**Files:**
- Create: `src/tui/Footer.tsx`

- [ ] **Step 1: Implement (no test — trivial)**

`src/tui/Footer.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";

interface Props {
  connection: "connecting" | "connected" | "reconnecting";
  mode: "normal" | "insert";
}

export function Footer({ connection, mode }: Props) {
  const light = connection === "connected" ? "\u25CF" : "\u25CB";
  const hints =
    mode === "insert"
      ? "Enter: send · Esc: normal"
      : "j/k: nav · Enter: open · i: type · /: filter · q: quit";
  return (
    <Box>
      <Text color={connection === "connected" ? "green" : "yellow"}>
        {light} {connection}
      </Text>
      <Text color="gray">  ·  {hints}</Text>
    </Box>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/tui/Footer.tsx
git commit -m "feat(tui): Footer with status and hints"
```

---

## Task 22: TUI — store hook + keybinds + App assembly

**Files:**
- Create: `src/tui/useStore.ts`
- Create: `src/tui/keybinds.ts`
- Modify: `src/tui/App.tsx`
- Create: `tests/tui/App.test.tsx`

- [ ] **Step 1: Write the store hook**

`src/tui/useStore.ts`:

```ts
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
```

- [ ] **Step 2: Write keybinds dispatcher**

`src/tui/keybinds.ts`:

```ts
import type { Key } from "ink";
import type { Action, State } from "../store/types.js";
import { selectDmList } from "../store/selectors.js";

export interface KeyContext {
  input: string;
  key: Key;
  state: State;
  bufferRef: { current: string };
}

export interface KeyOutcome {
  actions: Action[];
  send?: { channelId: string; content: string };
  loadOlder?: { channelId: string };
  exit?: boolean;
}

export function handleKey(ctx: KeyContext): KeyOutcome {
  const { input, key, state, bufferRef } = ctx;
  const out: KeyOutcome = { actions: [] };

  if (state.focus === "conversation" && ctx.state.activeDmId && isInsertMode(state)) {
    if (key.escape) {
      out.actions.push({ type: "focus/set", focus: "conversation" });
      out.actions.push({ type: "sendError/set", message: null });
      setMode(out.actions, "normal");
      return out;
    }
    if (key.return) {
      const content = bufferRef.current.trim();
      if (content) {
        out.send = { channelId: ctx.state.activeDmId, content };
        bufferRef.current = "";
      }
      return out;
    }
    return out;
  }

  if (input === "q" || (input === ":" && false)) {
    out.exit = true;
    return out;
  }

  if (key.escape) {
    if (state.filter) out.actions.push({ type: "filter/set", value: "" });
    return out;
  }

  if (input === "/") {
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

  if (state.focus === "conversation") {
    if (input === "i") {
      setMode(out.actions, "insert");
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

  return out;
}

function isInsertMode(state: State): boolean {
  return state.focus === "conversation" && (state as State & { mode?: string }).mode === "insert";
}

function setMode(_actions: Action[], _mode: "normal" | "insert"): void {
  // Mode is tracked in component-local React state (see App.tsx) — not in the store —
  // so this function is intentionally a no-op. Kept here as a hook point in case
  // mode moves into the store later.
}
```

*Note: `isInsertMode` checks a field that isn't on `State`. Mode lives in component-local state in App.tsx below. The helper returns false in the pure path; the App short-circuits before calling `handleKey` when in insert mode and passes the real mode via the component.*

To keep the keybinds module pure and testable, App.tsx will NOT rely on the insert-branch above. The App handles insert mode directly via `ink-text-input`'s own submit handler (see Task 22 Step 4). Simplify `handleKey` by deleting the insert branch — we only need normal-mode handling here. Replace the implementation above with:

```ts
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
```

- [ ] **Step 3: Write failing App test**

`tests/tui/App.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../src/tui/App.js";
import { createStore } from "../../src/store/store.js";
import { initialState, type Message } from "../../src/store/types.js";

function fakeClient() {
  const calls: Array<{ kind: string; args: unknown[] }> = [];
  return {
    calls,
    client: {
      async login(token: string) {
        calls.push({ kind: "login", args: [token] });
      },
      async logout() {},
      async fetchHistory() {
        return [] as Message[];
      },
      async send(channelId: string, content: string) {
        calls.push({ kind: "send", args: [channelId, content] });
      },
      on() {},
    },
  };
}

describe("App", () => {
  it("renders with a preloaded store (DM list + empty conversation)", () => {
    const store = createStore({
      ...initialState,
      dms: {
        "1": {
          id: "1",
          name: "alice",
          isGroup: false,
          memberCount: 1,
          lastActivityAt: 0,
          unread: false,
        },
      },
      activeDmId: "1",
      connection: "connected",
    });
    const { client } = fakeClient();
    const { lastFrame } = render(<App store={store} client={client} />);
    const frame = lastFrame()!;
    expect(frame).toContain("alice");
    expect(frame).toContain("connected");
    expect(frame).toContain("no messages");
  });
});
```

- [ ] **Step 4: Implement App**

Replace `src/tui/App.tsx` (was stub):

```tsx
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
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/tui tests/tui/App.test.tsx
git commit -m "feat(tui): App assembly, store hook, and keybind routing"
```

---

## Task 23: Auto-fetch history when a DM is first opened

**Files:**
- Modify: `src/tui/App.tsx`

- [ ] **Step 1: Add the effect**

Inside `App`, after the existing `useInput`, add:

```tsx
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
```

- [ ] **Step 2: Typecheck + test**

Run: `npm run typecheck && npm test`
Expected: exit 0; all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/tui/App.tsx
git commit -m "feat(tui): initial history fetch on DM open"
```

---

## Task 24: Image rendering inside conversation (inline replace of placeholder)

**Files:**
- Create: `src/tui/ImageView.tsx`
- Modify: `src/tui/Conversation.tsx`

- [ ] **Step 1: Create ImageView**

`src/tui/ImageView.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { renderImageFromUrl, placeholderFor } from "../image/render.js";
import { resolveProtocol, type RenderProtocol } from "../image/protocol.js";
import type { Attachment } from "../store/types.js";
import type { ImageProtocol } from "../config/config.js";

interface Props {
  a: Attachment;
  protocolChoice: ImageProtocol;
}

export function ImageView({ a, protocolChoice }: Props) {
  const [rendered, setRendered] = useState<string | null>(null);
  const protocol: RenderProtocol = resolveProtocol(protocolChoice, process.env);
  const isImage = a.contentType?.startsWith("image/") ?? false;
  useEffect(() => {
    if (!isImage || protocol === "none") return;
    let alive = true;
    renderImageFromUrl(a.url, { protocol }).then((r) => {
      if (alive) setRendered(r);
    });
    return () => {
      alive = false;
    };
  }, [a.url, isImage, protocol]);
  if (!isImage) return <Text color="gray">  {placeholderFor(a.name, a.size)}</Text>;
  if (!rendered) return <Text color="gray">  {placeholderFor(a.name, a.size)}</Text>;
  return <Text>{rendered}</Text>;
}
```

- [ ] **Step 2: Thread `protocolChoice` through Conversation → MessageLine**

Edit `src/tui/Conversation.tsx`:

```tsx
import { ImageView } from "./ImageView.js";
import type { ImageProtocol } from "../config/config.js";

interface Props {
  view: ConversationView | null;
  title: string;
  focused: boolean;
  imageProtocol?: ImageProtocol;
}

export function Conversation({ view, title, focused, imageProtocol = "auto" }: Props) {
  // ... existing code, passing imageProtocol down to MessageLine
```

Pass through to `MessageLine` and use `ImageView` in place of the existing `AttachmentLine` when `a.contentType?.startsWith("image/")`. Keep the existing placeholder path for non-image attachments (future-proofing).

- [ ] **Step 3: Pass config from App**

In `src/tui/App.tsx`, load the config once (at module scope) and pass `imageProtocol`:

```tsx
import { loadConfig } from "../config/config.js";
import { paths } from "../config/paths.js";
const config = loadConfig(paths.configFile);
// ...
<Conversation view={conv} title={active?.name ?? "(no DM)"} focused={state.focus === "conversation"} imageProtocol={config.imageProtocol} />
```

- [ ] **Step 4: Update Conversation test for default behavior**

Conversation tests already pass without `imageProtocol` because non-image attachments render as placeholders regardless. Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/tui/ImageView.tsx src/tui/Conversation.tsx src/tui/App.tsx
git commit -m "feat(tui): inline image rendering for received images"
```

---

## Task 25: Wire build and smoke-test the CLI

**Files:**
- Modify: `package.json` (already has `build`)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: `dist/` populated with `bin/discord-cli.js`, `src/**/*.js`. Exit 0.

- [ ] **Step 2: Smoke test — no auth flow**

Run: `node dist/bin/discord-cli.js`
Expected: exits with `Not logged in. Run 'discord-cli login' first.` on stderr and non-zero exit.

Run: `node dist/bin/discord-cli.js logout`
Expected: prints `logged out`, exit 0.

Run: `node dist/bin/discord-cli.js --help`
Expected: commander help with `login`, `logout`, `help`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit --allow-empty -m "chore: smoke-test build output"
```

---

## Task 26: QA checklist (manual verification document)

**Files:**
- Create: `docs/qa.md`
- Create: `README.md`

- [ ] **Step 1: Write QA checklist**

`docs/qa.md`:

```markdown
# Manual QA checklist

Run on a real Discord account you're willing to risk.

## Login
- [ ] `discord-cli login` opens a Chromium window on the Discord login page
- [ ] Normal email/password login works; captcha/2FA/email codes are handled in-browser
- [ ] After redirect to `/channels/@me`, the browser closes automatically
- [ ] `~/.discord-cli/auth.json` is written with mode `600`
- [ ] CLI prints `✔ logged in as <username>`

## Manual login fallback
- [ ] `discord-cli login --manual` prompts for a token paste
- [ ] Pasting a valid token succeeds; pasting empty string errors out cleanly

## TUI startup
- [ ] `discord-cli` (no args) connects and shows the DM list within a few seconds
- [ ] Footer shows `● connected`
- [ ] Disabling Wi-Fi flips footer to `○ reconnecting…`; re-enabling returns to `● connected`

## DM list
- [ ] Friends and group DMs both appear
- [ ] Group DMs show `(N)` member count
- [ ] Unread DMs show the `●` bullet
- [ ] Sending someone a message elsewhere updates `lastActivityAt` → that DM moves up the list

## Conversation
- [ ] Selecting a DM fetches the last 50 messages
- [ ] Scrolling up past the oldest message triggers a "loading older messages" indicator and loads 50 more
- [ ] At the top of the channel's history, no further loads happen
- [ ] Sending a message appears in the conversation (via the gateway echo) with correct time

## Images
- [ ] A received PNG renders inline (iTerm2/Kitty) or as a halfBlock image (other terminals)
- [ ] A received file with `contentType: image/…` but unreachable URL falls back to `[image: name (size)]`
- [ ] Non-image attachments (PDF etc.) always show the placeholder

## Live updates + unread
- [ ] A message in a non-active DM flips its row to unread (`●`, yellow)
- [ ] Opening that DM clears the unread indicator
- [ ] If you're scrolled up when a new message arrives, the view stays put and shows `↓ N new messages`; pressing `G` or `End` jumps to bottom and clears the counter

## Exit
- [ ] `q` exits cleanly; terminal is restored
- [ ] `discord-cli logout` removes `~/.discord-cli/auth.json`
```

- [ ] **Step 2: Write README**

`README.md`:

```markdown
# discord-cli

Terminal Discord client for DMs. Inspired by [instagram-cli](https://github.com/supreme-gg-gg/instagram-cli).

**Warning:** Uses your regular Discord user account via an unofficial selfbot library. This is a TOS violation and can result in account termination. You have been warned.

## Install

```sh
npm install
npx playwright install chromium   # one-time
npm run build
```

## Usage

```sh
node dist/bin/discord-cli.js login        # opens a browser
node dist/bin/discord-cli.js login --manual   # paste token directly
node dist/bin/discord-cli.js              # launch TUI
node dist/bin/discord-cli.js logout
```

## Keybinds

Normal mode:
- `j`/`k` or `↓`/`↑`: move in focused pane
- `h`/`l` or `←`/`→`: switch focus (list ↔ conversation)
- `Enter`: open DM (from list)
- `i`: start typing a message (in conversation)
- `/`: filter DM list
- `q`: quit
- `Esc`: cancel filter

Insert mode:
- `Enter`: send
- `Esc`: back to normal

## Config

`~/.discord-cli/config.json`:
```json
{
  "imageProtocol": "auto",
  "initialHistory": 50,
  "theme": { "unread": "yellow", "author": "cyan", "time": "gray" }
}
```

## Scope

**In:** 1:1 DMs, group DMs, send/receive text, inline image rendering.
**Out:** servers, voice, reactions, replies, edits, deletes, attachments upload, typing indicators.
```

- [ ] **Step 3: Commit**

```bash
git add docs/qa.md README.md
git commit -m "docs: QA checklist and README"
```

---

## Self-review

**Spec coverage**
- Login (Playwright + manual fallback): Tasks 15, 16, 17.
- Logout: Task 17.
- Token file chmod 600: Task 4.
- Two-pane TUI with arrow + vim keys: Tasks 18, 19, 20, 21, 22.
- DM list with unread + group member count + sort: Tasks 6, 8, 18.
- Conversation with author/time/content + image placeholder + pending-new counter: Task 19, 24.
- Send text: Task 22.
- Live messages via gateway: Tasks 11, 22.
- Scrollback load-more: Tasks 7, 22.
- Scroll-aware auto-scroll (no yank, show "N new messages"): Tasks 7, 19.
- Reconnect indicator: Tasks 11, 21, 22.
- Config load/save with defaults: Task 3.
- Error logging to `error.log`: Task 14.
- No end-to-end tests against real Discord; manual QA: Task 26.

**Placeholder scan:** no "TBD"/"implement later"/"handle edge cases" without code.

**Type consistency:** `selectDmList`, `selectActiveConversation`, `DiscordClient`, `Action`/`State`, `Conversation` props, and `handleKey` signatures all match their call sites across tasks. `handleKey` was deliberately simplified in Task 22 Step 2 (insert-mode branch removed in favor of `ink-text-input`'s own submit handler) — the final implementation block is the authoritative one; the earlier draft above it is annotated as superseded.

**Scope:** Single implementation plan, one feature set, no subsystems to split out.
