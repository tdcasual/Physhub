import { expect, type Page } from "@playwright/test";

const editorSecret =
  process.env.PLAYWRIGHT_EDITOR_SESSION_SECRET ??
  "playwright-editor-session-secret";

export async function unlockEditor(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Unlock editor" })).toBeVisible();
  await page.getByLabel("Editor secret").fill(editorSecret);
  await page.getByRole("button", { name: "Unlock" }).click();
}
