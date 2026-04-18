import { chromium, type Browser, type Page } from "playwright";

export interface LoginResult {
  token: string;
  username: string;
}

type PageEvaluator = Pick<Page, "evaluate">;

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
    const username = await extractUsername(page);
    return { token, username: username ?? "unknown" };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function extractUsername(page: PageEvaluator): Promise<string | null> {
  const raw = await readLocalStorageValue(page, "user");
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { username?: string }).username ?? null;
  } catch {
    return null;
  }
}

export async function extractToken(page: PageEvaluator): Promise<string | null> {
  const viaLocal = normalizeStoredToken(await readLocalStorageValue(page, "token"));
  if (viaLocal) return viaLocal;

  return normalizeStoredToken(
    await page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const idb = globalThis.indexedDB;
        if (!idb || typeof idb.open !== "function") {
          resolve(null);
          return;
        }
        const req = idb.open("cookieStorage");
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
    ),
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

async function readLocalStorageValue(page: PageEvaluator, key: string): Promise<string | null> {
  return await page.evaluate((storageKey) => {
    try {
      const storage = globalThis.localStorage;
      if (!storage || typeof storage.getItem !== "function") return null;
      const value = storage.getItem(storageKey);
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }, key);
}

function normalizeStoredToken(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/^"|"$/g, "");
}
