import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const PREFIX = `scrypt$N=${N}$r=${R}$p=${P}`;

export function isUsablePassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

export function isUsableUsername(username: string): boolean {
  return /^[a-zA-Z0-9._-]{2,32}$/.test(username);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = (await scrypt(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
  })) as Buffer;

  return `${PREFIX}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  const parts = storedHash.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = Buffer.from(parts[4] ?? "", "base64url");
  const expected = Buffer.from(parts[5] ?? "", "base64url");

  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  const actual = (await scrypt(password, salt, expected.length, {
    N,
    r: R,
    p: P,
  })) as Buffer;

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
