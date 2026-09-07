import { extname } from 'path';
import { BadRequestException } from '@nestjs/common';

/**
 * P0-C-7 — avatar upload validation, mirroring the marketplace upload
 * validators' exact approach (declared MIME type, filename extension, and
 * real leading-byte file signature must all agree). Previously this
 * endpoint trusted the client-supplied Content-Type alone
 * (`file.mimetype.startsWith('image/')`), which is spoofable — any file
 * uploaded with a forged `image/*` Content-Type passed. Images only, no
 * PDF/video — an avatar is never anything else.
 */

export const MAX_AVATAR_FILE_BYTES = 2 * 1024 * 1024; // matches apps/web's existing 2MB limit

function bytesStartWith(
  buffer: Buffer,
  offset: number,
  expected: number[],
): boolean {
  if (buffer.length < offset + expected.length) return false;
  return expected.every((byte, i) => buffer[offset + i] === byte);
}

interface AllowedAvatarType {
  mimetype: string;
  extensions: string[];
  matchesSignature: (buffer: Buffer) => boolean;
}

const ALLOWED_AVATAR_TYPES: AllowedAvatarType[] = [
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

export interface AvatarFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Throws BadRequestException on any violation — same all-three-must-agree
 * discipline as this codebase's other upload validators. */
export function validateAvatarFile(file: AvatarFileLike): void {
  if (!file.buffer || file.buffer.length === 0) {
    throw new BadRequestException(
      `File "${file.originalname}" is empty or unreadable.`,
    );
  }
  if (file.size > MAX_AVATAR_FILE_BYTES) {
    throw new BadRequestException(
      `File is too large — the limit is ${MAX_AVATAR_FILE_BYTES / (1024 * 1024)}MB.`,
    );
  }

  const declared = ALLOWED_AVATAR_TYPES.find(
    (t) => t.mimetype === file.mimetype,
  );
  if (!declared) {
    throw new BadRequestException(
      `Unsupported file type "${file.mimetype}" — only JPEG, PNG, or WEBP images are accepted.`,
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
