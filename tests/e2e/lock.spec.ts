import { expect, test } from "@playwright/test";

import { unlockEditor } from "./helpers/unlock";

test("lock clears the session and returns to the unlock form", async ({ page }) => {
  await unlockEditor(page, "/drafts");
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await expect(page.getByRole("button", { name: "锁定" })).toBeVisible();

  await page.getByRole("button", { name: "锁定" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/drafts");
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "锁定" })).not.toBeVisible();
});
