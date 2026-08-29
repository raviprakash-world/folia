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
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
