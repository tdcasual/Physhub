import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentKeyManager } from "@/components/agent-keys/agent-key-manager";
import type { ManagedApiKey } from "@/lib/domain/api-key-repository";

const sampleKey: ManagedApiKey = {
  id: "key_1",
  name: "备课 agent",
  prefix: "phk_abcdef12",
  scopes: ["questions:read"],
  createdAt: "2026-09-09T00:00:00.000Z",
  lastUsedAt: null,
  revokedAt: null,
  createdByUsername: "tdcasual",
  copyable: true,
  kind: "stored",
};

describe("AgentKeyManager", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("issues a key and copies plaintext from the dialog", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          apiKey: sampleKey,
          token: "phk_issuedtoken",
        }),
      }),
    );
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    render(<AgentKeyManager initialKeys={[]} />);
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "备课 agent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "签发" }));

    await waitFor(() => {
      expect(screen.getByLabelText("明文")).toHaveValue("phk_issuedtoken");
    });

    fireEvent.click(
      within(screen.getByRole("region", { name: "新密钥" })).getByRole("button", {
        name: "复制",
      }),
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("phk_issuedtoken");
    });
  });

  it("reveals an existing key through the copy button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "phk_existing" }),
      }),
    );
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });

    render(<AgentKeyManager initialKeys={[sampleKey]} />);
    fireEvent.click(screen.getByRole("button", { name: "复制" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("phk_existing");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/api-keys/key_1/reveal",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("disables copy when the stored key has no plaintext", () => {
    render(
      <AgentKeyManager initialKeys={[{ ...sampleKey, copyable: false }]} />,
    );

    expect(screen.getByRole("button", { name: "复制" })).toBeDisabled();
    expect(screen.getByText("签发时未保存明文，请重新签发。")).toBeInTheDocument();
  });
});
