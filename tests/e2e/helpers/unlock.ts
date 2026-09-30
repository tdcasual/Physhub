import { expect, type Page } from "@playwright/test";

const username = process.env.TEACHER_BOOTSTRAP_USERNAME ?? "owner";
const password =
  process.env.TEACHER_BOOTSTRAP_PASSWORD ?? "playwright-teacher-password";

export async function unlockEditor(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await page.getByLabel("帐号").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
}
