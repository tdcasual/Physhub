import { expect, test } from "@playwright/test";

import { unlockEditor } from "./helpers/unlock";

test("promote without a knowledge point stays blocked in the UI and 400s on the API", async ({
  page,
  request,
}) => {
  await unlockEditor(page, "/questions/new");
  await expect(
    page.getByRole("heading", { name: "录入试题" }),
  ).toBeVisible();

  const uniqueStem = `E2E missing KP ${Date.now()} $a$`;
  await page.getByLabel("题干").fill(uniqueStem);
  await page.getByRole("button", { name: "存为草稿" }).click();
  await expect(page.getByRole("heading", { name: "审题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "入库" })).toBeDisabled();

  const draftId = page.url().split("/drafts/")[1]?.split("?")[0];
  expect(draftId).toBeTruthy();

  const cookies = await page.context().cookies();
  const response = await request.post(`/api/drafts/${draftId}/promote`, {
    headers: {
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  expect(response.status()).toBe(400);
  const payload = (await response.json()) as { error?: string };
  expect(payload.error).toContain("必须确认知识点");
});

test("selecting a named knowledge point lets a teacher promote a draft", async ({
  page,
}) => {
  const token = `E2E-promote-${Date.now()}`;
  await unlockEditor(page, "/questions/new");
  await expect(
    page.getByRole("heading", { name: "录入试题" }),
  ).toBeVisible();

  await page.getByLabel("题干").fill(`${token} $a$`);
  await page.getByRole("checkbox", { name: "运动学" }).check();
  await page.getByRole("button", { name: "存为草稿" }).click();
  await expect(page.getByRole("heading", { name: "审题" })).toBeVisible();
  await page.getByRole("button", { name: "入库" }).click();
  await expect(page.getByText(/已入库/)).toBeVisible();

  await page.goto("/questions");
  await expect(page.getByText(token)).toBeVisible();
});

test("draft detail without a cookie only shows the unlock form", async ({ page }) => {
  await page.goto("/drafts/missing-draft");
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("answerJson");
  await expect(page.locator("body")).not.toContainText("secret-answer");
});
