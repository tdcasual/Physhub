import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";

export class ApiKeyWrapConfigError extends Error {
  constructor(message = "密钥保险未配置") {
    super(message);
    this.name = "ApiKeyWrapConfigError";
  }
}

export class ApiKeyUnwrapError extends Error {
  constructor(message = "无法解开密钥") {
    super(message);
    this.name = "ApiKeyUnwrapError";
  }
}

export function isApiKeyWrapConfigError(error: unknown): error is ApiKeyWrapConfigError {
  return error instanceof ApiKeyWrapConfigError;
}

export function readWrapKey(secret = process.env.AGENT_KEY_WRAP_SECRET): Buffer {
  const value = secret?.trim() ?? "";

  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new ApiKeyWrapConfigError();
  }

  return Buffer.from(value, "hex");
}

export function wrapApiKeyPlaintext(
  token: string,
  key: Buffer = readWrapKey(),
): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join("$");
}

export function unwrapApiKeyPlaintext(
  blob: string,
  key: Buffer = readWrapKey(),
): string {
  const parts = blob.split("$");

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new ApiKeyUnwrapError();
  }

  const iv = Buffer.from(parts[1] ?? "", "base64url");
  const encrypted = Buffer.from(parts[2] ?? "", "base64url");
  const tag = Buffer.from(parts[3] ?? "", "base64url");

  if (iv.length !== IV_LENGTH || encrypted.length === 0 || tag.length !== TAG_LENGTH) {
    throw new ApiKeyUnwrapError();
  }

  try {
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new ApiKeyUnwrapError();
  }
}
