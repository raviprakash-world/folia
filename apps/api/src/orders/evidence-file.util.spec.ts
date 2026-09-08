import { BadRequestException } from '@nestjs/common';
import {
  MAX_EVIDENCE_FILE_BYTES,
  validateEvidenceFile,
  type EvidenceFileLike,
} from './evidence-file.util';

function jpegBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(100),
  ]);
}

function pngBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(100),
  ]);
}

function webpBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'latin1'),
    Buffer.alloc(100),
  ]);
}

function mp4Buffer(): Buffer {
  return Buffer.concat([
    Buffer.alloc(4),
    Buffer.from('ftyp', 'latin1'),
    Buffer.alloc(100),
  ]);
}

function file(overrides: Partial<EvidenceFileLike> = {}): EvidenceFileLike {
  const buffer = overrides.buffer ?? jpegBuffer();
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

describe('validateEvidenceFile', () => {
  it('accepts a genuine JPEG (correct mimetype, extension, and magic bytes)', () => {
    expect(() => validateEvidenceFile(file())).not.toThrow();
  });

  it('accepts a genuine PNG', () => {
    expect(() =>
      validateEvidenceFile(
        file({
          originalname: 'photo.png',
          mimetype: 'image/png',
          buffer: pngBuffer(),
        }),
      ),
    ).not.toThrow();
  });

  it('accepts a genuine WEBP', () => {
    expect(() =>
      validateEvidenceFile(
        file({
          originalname: 'photo.webp',
          mimetype: 'image/webp',
          buffer: webpBuffer(),
        }),
      ),
    ).not.toThrow();
  });

  it('accepts a genuine MP4', () => {
    expect(() =>
      validateEvidenceFile(
        file({
          originalname: 'clip.mp4',
          mimetype: 'video/mp4',
          buffer: mp4Buffer(),
        }),
      ),
    ).not.toThrow();
  });

  it('rejects an empty buffer — malformed upload, not a real file', () => {
    expect(() =>
      validateEvidenceFile(file({ buffer: Buffer.alloc(0), size: 0 })),
    ).toThrow(BadRequestException);
  });

  it('rejects a file over the size limit', () => {
    const big = jpegBuffer();
    expect(() =>
      validateEvidenceFile(
        file({ buffer: big, size: MAX_EVIDENCE_FILE_BYTES + 1 }),
      ),
    ).toThrow(/too large/);
  });

  it('rejects an unsupported MIME type outright (e.g. a PDF, or something scriptable like text/html)', () => {
    expect(() =>
      validateEvidenceFile(
        file({ originalname: 'evidence.pdf', mimetype: 'application/pdf' }),
      ),
    ).toThrow(/Unsupported file type/);
    expect(() =>
      validateEvidenceFile(
        file({ originalname: 'evil.html', mimetype: 'text/html' }),
      ),
    ).toThrow(/Unsupported file type/);
  });

  it('rejects an executable/scriptable file masquerading with an allowed extension and mimetype but non-matching content', () => {
    // A real JS/shell payload, dressed up as a "photo.jpg" with a spoofed
    // image/jpeg Content-Type — exactly the case naive mimetype-only
    // checking (e.g. AuthController's avatar upload) would miss.
    const payload = Buffer.from('#!/bin/sh\nrm -rf /\n');
    expect(() =>
      validateEvidenceFile(
        file({
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          buffer: payload,
          size: payload.length,
        }),
      ),
    ).toThrow(/does not look like a genuine/);
  });

  it('rejects a mismatched extension for an otherwise-valid declared type (e.g. a PNG file renamed to .jpg)', () => {
    expect(() =>
      validateEvidenceFile(
        file({
          originalname: 'photo.jpg',
          mimetype: 'image/png',
          buffer: pngBuffer(),
        }),
      ),
    ).toThrow(/extension does not match/);
  });

  it('rejects when the real file signature does not match the declared mimetype (a JPEG mislabeled as PNG)', () => {
    expect(() =>
      validateEvidenceFile(
        file({
          originalname: 'photo.png',
          mimetype: 'image/png',
          buffer: jpegBuffer(),
        }),
      ),
    ).toThrow(/does not look like a genuine/);
  });

  it('handles a truncated/malformed file (too short to contain any real signature) safely, without crashing', () => {
    const tiny = Buffer.from([0x01, 0x02]);
    expect(() =>
      validateEvidenceFile(file({ buffer: tiny, size: tiny.length })),
    ).toThrow(BadRequestException);
  });
});
