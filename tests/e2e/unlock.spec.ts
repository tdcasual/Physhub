import { expect, test } from "@playwright/test";

const username = process.env.TEACHER_BOOTSTRAP_USERNAME ?? "owner";
const password =
  process.env.TEACHER_BOOTSTRAP_PASSWORD ?? "playwright-teacher-password";

test("wrong password stays on the login page", async ({ page }) => {
  await page.goto("/drafts");

  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await page.getByLabel("帐号").fill(username);
  await page.getByLabel("密码").fill("not-the-password");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("帐号或密码不正确")).toBeVisible();
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
});

test("right password reaches the drafts list", async ({ page }) => {
  await page.goto("/drafts");

  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await page.getByLabel("帐号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
});
