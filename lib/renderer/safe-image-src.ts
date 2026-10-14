export function isSafeImageSrc(src: string) {
  const trimmedSrc = src.trim();
  return (
    trimmedSrc.startsWith("/assets/") ||
    trimmedSrc.startsWith("/uploads/") ||
    trimmedSrc.startsWith("/api/assets/") ||
    trimmedSrc.startsWith("/api/raw-assets/")
  );
}

export function isLocalRawAssetImageUrl(src: string): boolean {
  return src.trim().startsWith("/api/raw-assets/");
}
