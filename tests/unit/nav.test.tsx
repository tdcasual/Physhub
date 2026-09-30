import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { Nav } from "@/components/nav";

describe("Nav", () => {
  it("links to 工作台, 题库, 录入, 知识点, and 密钥", () => {
    render(<Nav />);

    expect(screen.getByRole("link", { name: "题库" })).toHaveAttribute(
      "href",
      "/questions",
    );
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/drafts",
    );
    expect(screen.getByRole("link", { name: "录入" })).toHaveAttribute(
      "href",
      "/questions/new",
    );
    expect(screen.getByRole("link", { name: "知识点" })).toHaveAttribute(
      "href",
      "/taxonomy",
    );
    expect(screen.getByRole("link", { name: "密钥" })).toHaveAttribute(
      "href",
      "/agent-keys",
    );
    expect(screen.queryByRole("button", { name: "锁定" })).not.toBeInTheDocument();
  });

  it("shows 锁定 only when unlocked", () => {
    render(<Nav unlocked />);

    expect(screen.getByRole("button", { name: "锁定" })).toBeInTheDocument();
  });
});
