const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
};

/**
 * No upload table in this schema persists the validated MIME type
 * alongside the stored URL (see storage.interface.ts's upload() —
 * UploadedFileResult never carried it, and none of User.avatarUrl /
 * ReturnEvidence.url / SellerVerification.documentUrl / ProductImage.url
 * have a sibling mimetype column). Deriving it from the extension at
 * serve time is safe specifically because every upload path that
 * reaches disk already went through this codebase's own
 * validate*File() util (avatar-file.util.ts /
 * orders/evidence-file.util.ts / sellers/seller-verification-file.util.ts
 * / sellers/seller-product-media-file.util.ts), which requires the
 * extension to match the real magic-byte-verified content type before
 * the file is ever written — the extension on disk is trustworthy by
 * construction, not client-supplied at this point.
 */
export function mimeFromExtension(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? 'application/octet-stream';
}
