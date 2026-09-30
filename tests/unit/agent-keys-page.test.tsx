import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  dashboardCookieStore,
  setDashboardCookie,
} from "@/tests/unit/helpers/dashboard-cookies";

vi.mock("next/headers", () => ({
  cookies: async () => dashboardCookieStore,
}));

const mocks = vi.hoisted(() => ({
  listManagedApiKeys: vi.fn(),
  readEditorSessionFromCookies: vi.fn(),
}));

vi.mock("@/lib/domain/api-key-repository", () => ({
  listManagedApiKeys: mocks.listManagedApiKeys,
}));

vi.mock("@/lib/auth/human-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/human-auth")>();

  return {
    ...actual,
    readEditorSessionFromCookies: mocks.readEditorSessionFromCookies,
  };
});

import AgentKeysPage from "@/app/(dashboard)/agent-keys/page";

describe("AgentKeysPage", () => {
  beforeEach(() => {
    mocks.listManagedApiKeys.mockReset();
    mocks.readEditorSessionFromCookies.mockReset();
    dashboardCookieStore.get.mockReset();
    setDashboardCookie(true);
  });

  it("renders unlock form without listing keys", async () => {
    setDashboardCookie(false);
    mocks.readEditorSessionFromCookies.mockResolvedValue(null);

    render(await AgentKeysPage());

    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(mocks.listManagedApiKeys).not.toHaveBeenCalled();
  });

  it("hides the manager from viewers", async () => {
    mocks.readEditorSessionFromCookies.mockResolvedValue({
      userId: "user_viewer",
      username: "viewer",
      role: "VIEWER",
    });

    render(await AgentKeysPage());

    expect(
      screen.getByText("只有编辑可以管理 Agent 密钥。"),
    ).toBeInTheDocument();
    expect(mocks.listManagedApiKeys).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "签发" })).not.toBeInTheDocument();
  });

  it("renders issued keys for an editor", async () => {
    mocks.readEditorSessionFromCookies.mockResolvedValue({
      userId: "user_owner",
      username: "tdcasual",
      role: "OWNER",
    });
    mocks.listManagedApiKeys.mockResolvedValue([
      {
        id: "dev-env",
        name: "本地开发密钥",
        prefix: "dev-agent-ke",
        scopes: [],
        createdAt: null,
        lastUsedAt: null,
        revokedAt: null,
        createdByUsername: null,
        copyable: true,
        kind: "dev-env",
      },
    ]);

    render(await AgentKeysPage());

    expect(screen.getByRole("heading", { name: "密钥" })).toBeInTheDocument();
    expect(screen.getByText("本地开发密钥")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "签发" })).toBeInTheDocument();
  });
});
