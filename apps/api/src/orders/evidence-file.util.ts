import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

/**
 * Security-hardened evidence-file validation for Phase 6D-3's DOA/damage
 * claim uploads — deliberately stricter than AuthController's avatar
 * upload (which only checks `mimetype.startsWith('image/')`, no
 * extension check, no content-signature check). Evidence is untrusted
 * customer input attached to a real financial claim, so this never
 * trusts the client-supplied `mimetype` header or filename extension in
 * isolation — a spoofed Content-Type or a renamed file (e.g. a script
 * saved as "photo.jpg") is caught by cross-checking the ACTUAL leading
 * bytes of the file against a real signature for the declared type. All
 * three (declared mimetype, filename extension, and real file signature)
 * must agree, or the upload is rejected.
 *
 * No new dependency was added for this — the allowed type set is small
 * and fixed (a handful of well-known image/video magic numbers), so a
 * few byte comparisons are simpler and more auditable than pulling in a
 * file-type-sniffing library for it.
 */

export const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024; // 10MB — generous for a phone photo/short clip, small enough to bound storage/abuse
export const MAX_EVIDENCE_FILES = 5;

function bytesStartWith(
  buffer: Buffer,
  offset: number,
  expected: number[],
): boolean {
  if (buffer.length < offset + expected.length) return false;
  return expected.every((byte, i) => buffer[offset + i] === byte);
}

interface AllowedEvidenceType {
  mimetype: string;
  extensions: string[];
  /** Whether `buffer`'s real leading bytes match this type's genuine file signature. */
  matchesSignature: (buffer: Buffer) => boolean;
}

const ALLOWED_EVIDENCE_TYPES: AllowedEvidenceType[] = [
  {
    mimetype: 'image/jpeg',
    extensions: ['.jpg', '.jpeg'],
    matchesSignature: (b) => bytesStartWith(b, 0, [0xff, 0xd8, 0xff]),
  },
  {
    mimetype: 'image/png',
    extensions: ['.png'],
    matchesSignature: (b) =>
      bytesStartWith(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    mimetype: 'image/webp',
    extensions: ['.webp'],
    matchesSignature: (b) =>
      bytesStartWith(b, 0, [0x52, 0x49, 0x46, 0x46]) && // 'RIFF'
      bytesStartWith(b, 8, [0x57, 0x45, 0x42, 0x50]), // 'WEBP'
  },
  {
    mimetype: 'video/mp4',
    extensions: ['.mp4'],
    matchesSignature: (b) => bytesStartWith(b, 4, [0x66, 0x74, 0x79, 0x70]), // 'ftyp'
  },
  {
    mimetype: 'video/quicktime',
    extensions: ['.mov'],
    // QuickTime containers can lead with any of several standard
    // top-level atom names, not just 'ftyp' — checking only 'ftyp' would
    // reject a real fraction of genuine phone-recorded .mov files.
    matchesSignature: (b) => {
      if (b.length < 8) return false;
      const atom = b.subarray(4, 8).toString('latin1');
      return ['ftyp', 'moov', 'free', 'wide', 'mdat', 'skip'].includes(atom);
    },
  },
];

export interface EvidenceFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Throws BadRequestException on any violation: empty/unreadable buffer,
 * oversized file, an unlisted MIME type, a filename extension that
 * doesn't match the declared MIME type, or file content whose real
 * signature doesn't match either. Never partially trusts one signal —
 * declared type, extension, and actual bytes must all agree.
 */
export function validateEvidenceFile(file: EvidenceFileLike): void {
  if (!file.buffer || file.buffer.length === 0) {
    throw new BadRequestException(
      `File "${file.originalname}" is empty or unreadable.`,
    );
  }
  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    throw new BadRequestException(
      `File "${file.originalname}" is too large — the limit is ${MAX_EVIDENCE_FILE_BYTES / (1024 * 1024)}MB.`,
    );
  }

  const declared = ALLOWED_EVIDENCE_TYPES.find(
    (t) => t.mimetype === file.mimetype,
  );
  if (!declared) {
    throw new BadRequestException(
      `Unsupported file type "${file.mimetype}" — only JPEG, PNG, or WEBP photos, or MP4/MOV videos, are accepted as evidence.`,
    );
  }

  const ext = extname(file.originalname).toLowerCase();
  if (!declared.extensions.includes(ext)) {
    throw new BadRequestException(
      `File "${file.originalname}"'s extension does not match its declared type "${file.mimetype}".`,
    );
  }

  if (!declared.matchesSignature(file.buffer)) {
    throw new BadRequestException(
      `File "${file.originalname}" does not look like a genuine ${file.mimetype} file — its content does not match its declared type.`,
    );
  }
}
