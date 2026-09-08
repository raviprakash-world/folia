import { BadRequestException } from '@nestjs/common';
import {
  MAX_PRODUCT_MEDIA_FILE_BYTES,
  validateProductMediaFile,
  type ProductMediaFileLike,
} from './seller-product-media-file.util';

function jpegBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(100),
  ]);
}

function pdfBuffer(): Buffer {
  return Buffer.concat([Buffer.from('%PDF-1.4', 'latin1'), Buffer.alloc(100)]);
}

function file(
  overrides: Partial<ProductMediaFileLike> = {},
): ProductMediaFileLike {
  const buffer = overrides.buffer ?? jpegBuffer();
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

describe('validateProductMediaFile', () => {
  it('accepts a genuine JPEG', () => {
    expect(() => validateProductMediaFile(file())).not.toThrow();
  });

  it('rejects an empty buffer', () => {
    expect(() =>
      validateProductMediaFile(file({ buffer: Buffer.alloc(0) })),
    ).toThrow(BadRequestException);
  });

  it('rejects a file over the size limit', () => {
    expect(() =>
      validateProductMediaFile(
        file({ size: MAX_PRODUCT_MEDIA_FILE_BYTES + 1 }),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects PDF — product photos are images only, unlike verification documents', () => {
    expect(() =>
      validateProductMediaFile(
        file({
          originalname: 'doc.pdf',
          mimetype: 'application/pdf',
          buffer: pdfBuffer(),
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects a filename extension that doesn't match the declared type", () => {
    expect(() =>
      validateProductMediaFile(file({ originalname: 'photo.png' })),
    ).toThrow(BadRequestException);
  });

  it('rejects content whose real signature does not match its declared type (a renamed file)', () => {
    expect(() =>
      validateProductMediaFile(
        file({
          originalname: 'fake.jpg',
          mimetype: 'image/jpeg',
          buffer: pdfBuffer(), // real PDF bytes, claimed as a JPEG
        }),
      ),
    ).toThrow(BadRequestException);
  });
});
