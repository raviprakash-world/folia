import type { Readable } from 'stream';

export interface UploadedFileResult {
  /** Publicly reachable URL for the stored file. */
  url: string;
  /** Backend-internal identifier for later deletion — never exposed to clients. */
  key: string;
}

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimetype: string;
  /** Logical grouping, e.g. 'avatars' — becomes part of the storage key/path. */
  directory: string;
}

/**
 * Storage abstraction (the "S3 abstraction" from the tech stack) — every
 * consumer (AuthService's avatar upload, and any future feature needing
 * file storage) depends on this interface, injected via the
 * STORAGE_SERVICE token, never on a concrete implementation directly.
 * LocalStorageService is the only implementation right now (this sandbox
 * has no reachable S3-compatible endpoint to build or test against — see
 * the README's Known Issues). Swapping in a real S3Service later
 * (e.g. via @aws-sdk/client-s3) means adding one new class that implements
 * this same interface and changing StorageModule's provider binding —
 * zero changes anywhere that calls it.
 */
export interface StorageService {
  upload(input: UploadFileInput): Promise<UploadedFileResult>;
  delete(key: string): Promise<void>;
  /**
   * P0-D — added alongside the first real file-retrieval endpoint
   * (files.controller.ts). Returns a real Node readable stream so the
   * controller can pipe it straight to the HTTP response without
   * buffering the whole file in memory; rejects (ENOENT-style) if the
   * key doesn't exist, which the controller maps to a 404. Kept
   * interface-level, not LocalStorageService-specific, so a future S3
   * implementation (GetObjectCommand's response body is also a
   * Node-compatible readable stream) needs no controller changes.
   */
  createReadStream(key: string): Promise<Readable>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
