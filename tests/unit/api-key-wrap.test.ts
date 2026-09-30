import { describe, expect, it } from "vitest";

import {
  ApiKeyUnwrapError,
  ApiKeyWrapConfigError,
  readWrapKey,
  unwrapApiKeyPlaintext,
  wrapApiKeyPlaintext,
} from "@/lib/auth/api-key-wrap";

const KEY = Buffer.from(
  "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00",
  "hex",
);

describe("api-key wrap", () => {
  it("round-trips plaintext and uses a unique iv", () => {
    const first = wrapApiKeyPlaintext("phk_secret", KEY);
    const second = wrapApiKeyPlaintext("phk_secret", KEY);

    expect(first).toMatch(/^v1\$/);
    expect(first).not.toEqual(second);
    expect(unwrapApiKeyPlaintext(first, KEY)).toBe("phk_secret");
    expect(unwrapApiKeyPlaintext(second, KEY)).toBe("phk_secret");
  });

  it("rejects a missing or short wrap secret", () => {
    expect(() => readWrapKey("")).toThrow(ApiKeyWrapConfigError);
    expect(() => readWrapKey("abc")).toThrow(ApiKeyWrapConfigError);
    expect(() => unwrapApiKeyPlaintext("not-a-blob", KEY)).toThrow(
      ApiKeyUnwrapError,
    );
  });
});
