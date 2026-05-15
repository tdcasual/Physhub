let lastStorageId = 0;

function nextStorageId(): string {
  const now = Date.now();
  lastStorageId = Math.max(now, lastStorageId + 1);

  return lastStorageId.toString();
}

function safeSegment(value: string, fallback: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || fallback
  );
}

function safePrefix(prefix: string): string {
  const segments = prefix
    .split(/[\\/]+/)
    .map((segment) => safeSegment(segment, ""))
    .filter(Boolean);

  if (segments.length === 0) {
    throw new Error("storage key prefix must contain at least one safe segment");
  }

  return segments.join("/");
}

function fileNameOnly(originalName: string): string {
  return originalName.split(/[\\/]+/).pop() ?? "";
}

function splitFileName(originalName: string): { base: string; extension: string } {
  const fileName = fileNameOnly(originalName).trim();
  const lastDot = fileName.lastIndexOf(".");

  if (lastDot > 0 && lastDot < fileName.length - 1) {
    return {
      base: fileName.slice(0, lastDot),
      extension: safeSegment(fileName.slice(lastDot + 1), "bin"),
    };
  }

  return {
    base: fileName,
    extension: "bin",
  };
}

export function buildStorageKey(prefix: string, originalName: string): string {
  const { base, extension } = splitFileName(originalName);

  return `${safePrefix(prefix)}/${nextStorageId()}-${safeSegment(
    base,
    "asset",
  )}.${extension}`;
}
