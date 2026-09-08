import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

/**
 * Marketplace Phase 3 — product photo upload validation. Mirrors
 * seller-verification-file.util.ts's exact approach (declared MIME type,
 * filename extension, and real leading-byte file signature must all
 * agree) — images only, no PDF/video, unlike either sibling validator:
 * nothing here is ever a document or a clip.
 */

export const MAX_PRODUCT_MEDIA_FILE_BYTES = 10 * 1024 * 1024; // 10MB, same bound as this codebase's other upload paths
export const MAX_PRODUCT_MEDIA_FILES = 8;

function bytesStartWith(
  buffer: Buffer,
  offset: number,
  expected: number[],
): boolean {
  if (buffer.length < offset + expected.length) return false;
  return expected.every((byte, i) => buffer[offset + i] === byte);
}

interface AllowedMediaType {
  mimetype: string;
  extensions: string[];
  matchesSignature: (buffer: Buffer) => boolean;
}

const ALLOWED_MEDIA_TYPES: AllowedMediaType[] = [
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
];

export interface ProductMediaFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Throws BadRequestException on any violation — same all-three-must-agree
 * discipline as this codebase's other upload validators. */
export function validateProductMediaFile(file: ProductMediaFileLike): void {
  if (!file.buffer || file.buffer.length === 0) {
    throw new BadRequestException(
      `File "${file.originalname}" is empty or unreadable.`,
    );
  }
  if (file.size > MAX_PRODUCT_MEDIA_FILE_BYTES) {
    throw new BadRequestException(
      `File "${file.originalname}" is too large — the limit is ${MAX_PRODUCT_MEDIA_FILE_BYTES / (1024 * 1024)}MB.`,
    );
  }

  const declared = ALLOWED_MEDIA_TYPES.find(
    (t) => t.mimetype === file.mimetype,
  );
  if (!declared) {
    throw new BadRequestException(
      `Unsupported file type "${file.mimetype}" — only JPEG, PNG, or WEBP photos are accepted.`,
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
