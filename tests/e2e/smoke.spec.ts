import { expect, test } from "@playwright/test";

test("home opens the manual editor with rendered math preview", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Open manual editor" }).click();

  await expect(
    page.getByRole("heading", { name: "Manual Question Editor" }),
  ).toBeVisible();

  const preview = page.getByRole("region", { name: "Live Preview" });
  await expect(preview).toBeVisible();
  await expect(preview.locator(".katex").first()).toBeVisible();
});
