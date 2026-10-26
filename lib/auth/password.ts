import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

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

function scryptKey(
  password: string,
  salt: Buffer,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { N, r: R, p: P }, (error, derived) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derived as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptKey(password, salt, KEY_LENGTH);

  return `${PREFIX}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

let timingPadHash: Promise<string> | null = null;

function timingPadHashValue(): Promise<string> {
  timingPadHash ??= hashPassword("physhub-timing-pad");
  return timingPadHash;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash) {
    await verifyPassword(password, await timingPadHashValue());
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

  const actual = await scryptKey(password, salt, expected.length);

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
