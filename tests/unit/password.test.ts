import { describe, expect, it } from "vitest";

import {
  hashPassword,
  isUsablePassword,
  isUsableUsername,
  verifyPassword,
} from "@/lib/auth/password";

describe("password hashing", () => {
  it("accepts a matching password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct-horse");

    await expect(verifyPassword("correct-horse", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
    await expect(verifyPassword("correct-horse", null)).resolves.toBe(false);
  });

  it("rejects unusable usernames and short passwords", () => {
    expect(isUsableUsername("owner")).toBe(true);
    expect(isUsableUsername("ab")).toBe(true);
    expect(isUsableUsername("a")).toBe(false);
    expect(isUsableUsername("has space")).toBe(false);
    expect(isUsablePassword("12345678")).toBe(true);
    expect(isUsablePassword("short")).toBe(false);
  });
});
