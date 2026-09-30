import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnlockForm } from "@/components/auth/unlock-form";

describe("UnlockForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("associates a failed login with the account fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "帐号或密码不正确" }),
      }),
    );

    render(<UnlockForm />);
    fireEvent.change(screen.getByLabelText("帐号"), {
      target: { value: "owner" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByLabelText("帐号")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
    expect(screen.getByLabelText("密码")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("帐号")).toHaveAttribute(
      "aria-describedby",
      "login-error",
    );
    expect(screen.getByText("帐号或密码不正确")).toHaveAttribute(
      "id",
      "login-error",
    );
  });
});
