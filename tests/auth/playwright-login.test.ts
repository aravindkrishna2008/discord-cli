import { afterEach, describe, expect, it } from "vitest";
import { extractToken, extractUsername } from "../../src/auth/playwright-login.js";

type MockPage = {
  evaluate: <T, Arg>(fn: (arg: Arg) => T, arg?: Arg) => Promise<T>;
};

describe("playwright login helpers", () => {
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const indexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");

  afterEach(() => {
    restoreGlobal("localStorage", localStorageDescriptor);
    restoreGlobal("indexedDB", indexedDbDescriptor);
  });

  it("reads token and username from localStorage when available", async () => {
    const values = new Map([
      ["token", '"abc123"'],
      ["user", '{"username":"alice"}'],
    ]);
    defineGlobal("localStorage", {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
    });

    const page = createMockPage();

    await expect(extractToken(page)).resolves.toBe("abc123");
    await expect(extractUsername(page)).resolves.toBe("alice");
  });

  it("falls back to IndexedDB when localStorage is unavailable", async () => {
    defineGlobal("localStorage", undefined);
    defineGlobal("indexedDB", {
      open() {
        const request: {
          error?: unknown;
          result?: {
            objectStoreNames: { contains: (name: string) => boolean };
            transaction: () => { objectStore: () => { getAll: () => unknown } };
          };
          onsuccess?: () => void;
          onerror?: () => void;
        } = {};

        queueMicrotask(() => {
          request.result = {
            objectStoreNames: {
              contains(name: string) {
                return name === "cookies";
              },
            },
            transaction() {
              return {
                objectStore() {
                  return {
                    getAll() {
                      const getAllRequest: {
                        result?: Array<{ name?: string; value?: string }>;
                        onsuccess?: () => void;
                        onerror?: () => void;
                      } = {};
                      queueMicrotask(() => {
                        getAllRequest.result = [{ name: "token", value: "fallback-token" }];
                        getAllRequest.onsuccess?.();
                      });
                      return getAllRequest;
                    },
                  };
                },
              };
            },
          };
          request.onsuccess?.();
        });

        return request;
      },
    });

    const page = createMockPage();

    await expect(extractToken(page)).resolves.toBe("fallback-token");
  });
});

function createMockPage(): MockPage {
  return {
    async evaluate<T, Arg>(fn: (arg: Arg) => T, arg?: Arg) {
      return await fn(arg as Arg);
    },
  };
}

function defineGlobal(name: "localStorage" | "indexedDB", value: unknown): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreGlobal(name: "localStorage" | "indexedDB", descriptor?: PropertyDescriptor): void {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }
  delete (globalThis as Record<string, unknown>)[name];
}
