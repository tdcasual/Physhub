const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_SIGNATURE = Buffer.from("%PDF-1.4\n");

export function signedPngBytes(size = 16): Buffer {
  const bytes = Buffer.alloc(Math.max(size, PNG_SIGNATURE.length));
  PNG_SIGNATURE.copy(bytes);
  return bytes;
}

export function signedPdfBytes(size = 16): Buffer {
  const bytes = Buffer.alloc(Math.max(size, PDF_SIGNATURE.length));
  PDF_SIGNATURE.copy(bytes);
  return bytes;
}
