import { chromium } from "playwright";

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

const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let loggedIn = false;
const issues = [];

for (const item of pages) {
  if (item.auth && !loggedIn) {
    await page.goto(`${base}/login`);
    await page.getByLabel("邮箱").fill("alpha@planner.local");
    await page.getByLabel("密码").fill("Test1234!");
    await page.getByRole("button", { name: "登录" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    loggedIn = true;
  }
  await page.goto(`${base}${item.path}`);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(250);

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflow = Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        const style = window.getComputedStyle(el);
        if (style.position === "fixed" || style.position === "absolute") return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.right > doc.clientWidth + 2;
      })
      .slice(0, 5)
      .map((el) => ({
        tag: el.tagName,
        cls: (el.getAttribute("class") || "").slice(0, 80),
        right: Math.round(el.getBoundingClientRect().right),
        width: Math.round(el.getBoundingClientRect().width),
      }));
    return { overflow, offenders };
  });

  if (metrics.overflow > 1) {
    issues.push({ name: item.name, viewport: "1440x900", ...metrics });
  }
}

await page.setViewportSize({ width: 390, height: 844 });
for (const item of pages) {
  if (item.auth) {
    await page.goto(`${base}${item.path}`);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const overflow = Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth;
      const offenders = Array.from(document.querySelectorAll("body *"))
        .filter((el) => {
          const style = window.getComputedStyle(el);
          if (style.position === "fixed" || style.position === "absolute") return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.right > doc.clientWidth + 2;
        })
        .slice(0, 5)
        .map((el) => ({
          tag: el.tagName,
          cls: (el.getAttribute("class") || "").slice(0, 80),
          right: Math.round(el.getBoundingClientRect().right),
          width: Math.round(el.getBoundingClientRect().width),
        }));
      return { overflow, offenders };
    });

    if (metrics.overflow > 1) {
      issues.push({ name: item.name, viewport: "390x844", ...metrics });
    }
  }
}

console.log(JSON.stringify(issues, null, 2));
if (issues.length) process.exit(1);
await browser.close();
