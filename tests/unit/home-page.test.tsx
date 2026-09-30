import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  dashboardCookieStore,
  setDashboardCookie,
} from "@/tests/unit/helpers/dashboard-cookies";

vi.mock("next/headers", () => ({
  cookies: async () => dashboardCookieStore,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import Home from "@/app/page";
import { redirect } from "next/navigation";

describe("Home", () => {
  beforeEach(() => {
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(false);
    vi.mocked(redirect).mockReset();
  });

  it("shows a Chinese landing and unlock form when locked", async () => {
    render(await Home());

    expect(screen.getByRole("heading", { name: "题库工作台" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去录入" })).toHaveAttribute(
      "href",
      "/questions/new",
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects unlocked editors to the workbench", async () => {
    setDashboardCookie(true);

    await Home();

    expect(redirect).toHaveBeenCalledWith("/drafts");
  });
});
