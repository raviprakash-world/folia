import { BadRequestException } from '@nestjs/common';
import {
  MAX_VERIFICATION_FILE_BYTES,
  validateVerificationFile,
  type VerificationFileLike,
} from './seller-verification-file.util';

function pdfBuffer(): Buffer {
  return Buffer.concat([Buffer.from('%PDF-1.4', 'latin1'), Buffer.alloc(100)]);
}

function jpegBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(100),
  ]);
}

function file(
  overrides: Partial<VerificationFileLike> = {},
): VerificationFileLike {
  const buffer = overrides.buffer ?? pdfBuffer();
  return {
    originalname: 'business-registration.pdf',
    mimetype: 'application/pdf',
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

describe('validateVerificationFile', () => {
  it('accepts a genuine PDF', () => {
    expect(() => validateVerificationFile(file())).not.toThrow();
  });

  it('accepts a genuine JPEG', () => {
    expect(() =>
      validateVerificationFile(
        file({
          originalname: 'id-card.jpg',
          mimetype: 'image/jpeg',
          buffer: jpegBuffer(),
        }),
      ),
    ).not.toThrow();
  });

  it('rejects an empty buffer', () => {
    expect(() =>
      validateVerificationFile(file({ buffer: Buffer.alloc(0) })),
    ).toThrow(BadRequestException);
  });

  it('rejects a file over the size limit', () => {
    const buffer = pdfBuffer();
    expect(() =>
      validateVerificationFile(
        file({ buffer, size: MAX_VERIFICATION_FILE_BYTES + 1 }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects an unsupported declared MIME type (e.g. video)', () => {
    expect(() =>
      validateVerificationFile(file({ mimetype: 'video/mp4' })),
    ).toThrow(BadRequestException);
  });

  it("rejects a filename extension that doesn't match the declared type", () => {
    expect(() =>
      validateVerificationFile(file({ originalname: 'document.png' })),
    ).toThrow(BadRequestException);
  });

  it('rejects content whose real signature does not match its declared type (a renamed file)', () => {
    expect(() =>
      validateVerificationFile(
        file({
          originalname: 'fake.pdf',
          mimetype: 'application/pdf',
          buffer: jpegBuffer(), // real JPEG bytes, claimed as a PDF
        }),
      ),
    ).toThrow(BadRequestException);
  });
});
