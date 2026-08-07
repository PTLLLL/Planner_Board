import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "design-qa");
const targetDir = process.argv[2] || "after";
const captureDir = path.join(outDir, targetDir);
fs.mkdirSync(captureDir, { recursive: true });

const base = "http://localhost:3000";

const pages = [
  { name: "landing", path: "/", auth: false },
  { name: "login", path: "/login", auth: false },
  { name: "register", path: "/register", auth: false },
  { name: "dashboard", path: "/dashboard", auth: true },
  { name: "calendar", path: "/calendar", auth: true },
  { name: "daily", path: "/tasks/daily?date=2026-08-06", auth: true },
  { name: "goals", path: "/goals", auth: true },
  { name: "inbox", path: "/agent/inbox", auth: true },
  { name: "console", path: "/agent/console", auth: true },
  { name: "eval", path: "/eval", auth: true },
  { name: "settings", path: "/settings", auth: true },
];

async function capturePage(page, name, viewport, fullPage = false) {
  const file = path.join(captureDir, `${name}-${viewport.width}x${viewport.height}${fullPage ? "-full" : ""}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(file);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let loggedIn = false;

for (const item of pages) {
  if (item.auth && !loggedIn) {
    await page.goto(`${base}/login`);
    await page.waitForSelector("#email", { timeout: 10000 });
    await page.getByLabel("邮箱").fill("alpha@planner.local");
    await page.getByLabel("密码").fill("Test1234!");
    await page.getByRole("button", { name: "登录" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    loggedIn = true;
  }
  await page.goto(`${base}${item.path}`);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
  await capturePage(page, item.name, { width: 1440, height: 900 });
}

await page.setViewportSize({ width: 390, height: 844 });
for (const item of pages.filter((entry) => entry.auth)) {
  await page.goto(`${base}${item.path}`);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(300);
  await capturePage(page, item.name, { width: 390, height: 844 });
}

const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const guestPage = await guestContext.newPage();
for (const item of pages.filter((entry) => !entry.auth)) {
  await guestPage.goto(`${base}${item.path}`);
  await guestPage.waitForLoadState("networkidle").catch(() => undefined);
  await guestPage.waitForTimeout(300);
  await capturePage(guestPage, item.name, { width: 390, height: 844 });
}
await guestContext.close();

await browser.close();
