import { expect, test } from "@playwright/test";

import { unlockEditor } from "./helpers/unlock";

test("lock clears the session and returns to the unlock form", async ({ page }) => {
  await unlockEditor(page, "/drafts");
  await expect(page.getByRole("heading", { name: "Drafts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lock", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/drafts");
  await expect(page.getByRole("heading", { name: "Unlock editor" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lock", exact: true }),
  ).not.toBeVisible();
});
