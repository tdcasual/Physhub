import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnlockForm } from "@/components/auth/unlock-form";

describe("UnlockForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("associates a failed unlock with the secret field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Unauthorized" }),
      }),
    );

    render(<UnlockForm />);
    fireEvent.change(screen.getByLabelText("Editor secret"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Editor secret")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
    expect(screen.getByLabelText("Editor secret")).toHaveAttribute(
      "aria-describedby",
      "unlock-error",
    );
    expect(screen.getByText("Unauthorized")).toHaveAttribute("id", "unlock-error");
  });
});
