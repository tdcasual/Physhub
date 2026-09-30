import { expect, test } from "@playwright/test";

const username = process.env.TEACHER_BOOTSTRAP_USERNAME ?? "owner";
const password =
  process.env.TEACHER_BOOTSTRAP_PASSWORD ?? "playwright-teacher-password";

test("home opens the new draft editor with rendered math preview", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("main").getByRole("link", { name: "去录入" }).click();

  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await page.getByLabel("帐号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(
    page.getByRole("heading", { name: "录入试题" }),
  ).toBeVisible();

  const preview = page.getByRole("region", { name: "预览" });
  await expect(preview).toBeVisible();
  await expect(preview.locator(".katex").first()).toBeVisible();
});
