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
