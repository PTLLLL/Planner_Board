import { expect, test } from "@playwright/test";

test("register, open dashboard and create a task", async ({ page }) => {
  const email = `e2e-${Date.now()}@planner.local`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("Test1234!");
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

  await page.goto("/tasks/daily?date=2026-08-06");
  await page.getByLabel("标题").fill("E2E 任务");
  await page.getByRole("button", { name: "添加任务" }).click();
  await expect(page.getByText("E2E 任务")).toBeVisible();
});
