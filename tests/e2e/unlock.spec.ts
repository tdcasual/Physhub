import { expect, test } from "@playwright/test";

const editorSecret =
  process.env.PLAYWRIGHT_EDITOR_SESSION_SECRET ??
  "playwright-editor-session-secret";

test("wrong secret stays on the unlock page", async ({ page }) => {
  await page.goto("/drafts");

  await expect(page.getByRole("heading", { name: "Unlock editor" })).toBeVisible();
  await page.getByLabel("Editor secret").fill("not-the-secret");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unlock editor" })).toBeVisible();
});

test("right secret reaches the drafts list", async ({ page }) => {
  await page.goto("/drafts");

  await expect(page.getByRole("heading", { name: "Unlock editor" })).toBeVisible();
  await page.getByLabel("Editor secret").fill(editorSecret);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Drafts" })).toBeVisible();
});
