import { describe, expect, it } from "vitest";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildStorageKey,
  removeLocalUpload,
  saveLocalUpload,
} from "@/lib/storage/storage-service";

const uuidPattern =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

describe("storage service", () => {
  it("builds safe storage keys", () => {
    expect(buildStorageKey("raw", "题目 1.png")).toMatch(
      new RegExp(`^raw/${uuidPattern}-[a-z0-9-]+\\.png$`),
    );
  });

  it("falls back for filenames without extensions or safe base names", () => {
    expect(buildStorageKey("raw", "???")).toMatch(
      new RegExp(`^raw/${uuidPattern}-asset\\.bin$`),
    );
    expect(buildStorageKey("raw", "worksheet")).toMatch(
      new RegExp(`^raw/${uuidPattern}-worksheet\\.bin$`),
    );
  });

  it("prevents path traversal in prefixes and original filenames", () => {
    const key = buildStorageKey("../raw\\incoming", "../../../题库 #1.PDF");

    expect(key).toMatch(new RegExp(`^raw/incoming/${uuidPattern}-1\\.pdf$`));
    expect(key).not.toContain("..");
    expect(key).not.toMatch(/^[\\/]/);
  });

  it("builds unique keys for repeated names", () => {
    const firstKey = buildStorageKey("raw", "image.png");
    const secondKey = buildStorageKey("raw", "image.png");

    expect(secondKey).not.toBe(firstKey);
  });

  it("rejects prefixes with no safe path segment", () => {
    expect(() => buildStorageKey("../..", "image.png")).toThrow(
      "storage key prefix must contain at least one safe segment",
    );
  });

  it("writes uploads under LOCAL_UPLOAD_DIR", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "storage-service-"));
    const previousUploadDir = process.env.LOCAL_UPLOAD_DIR;

    process.env.LOCAL_UPLOAD_DIR = uploadDir;

    try {
      const savedPath = await saveLocalUpload(
        "raw/incoming/sample.txt",
        Buffer.from("hello upload"),
      );

      expect(savedPath).toBe(join(uploadDir, "raw/incoming/sample.txt"));
      await expect(readFile(savedPath, "utf8")).resolves.toBe("hello upload");

      await removeLocalUpload("raw/incoming/sample.txt");
      await expect(readFile(savedPath, "utf8")).rejects.toThrow();
    } finally {
      if (previousUploadDir === undefined) {
        delete process.env.LOCAL_UPLOAD_DIR;
      } else {
        process.env.LOCAL_UPLOAD_DIR = previousUploadDir;
      }

      await rm(uploadDir, { recursive: true, force: true });
    }
  });

  it("prevents path traversal when saving uploads", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "storage-service-"));
    const previousUploadDir = process.env.LOCAL_UPLOAD_DIR;

    process.env.LOCAL_UPLOAD_DIR = uploadDir;

    try {
      await expect(
        saveLocalUpload("../escape.txt", Buffer.from("nope")),
      ).rejects.toThrow("storage key must stay inside the upload directory");
      await expect(
        saveLocalUpload("raw/../../escape.txt", Buffer.from("nope")),
      ).rejects.toThrow("storage key must stay inside the upload directory");
      await expect(
        saveLocalUpload("/absolute.txt", Buffer.from("nope")),
      ).rejects.toThrow("storage key must be relative");
    } finally {
      if (previousUploadDir === undefined) {
        delete process.env.LOCAL_UPLOAD_DIR;
      } else {
        process.env.LOCAL_UPLOAD_DIR = previousUploadDir;
      }

      await rm(uploadDir, { recursive: true, force: true });
    }
  });
});
