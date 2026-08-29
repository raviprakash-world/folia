import { randomUUID } from 'crypto';
import { join, extname } from 'path';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import type {
  StorageService,
  UploadFileInput,
  UploadedFileResult,
} from './storage.interface';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');

/**
 * Real local-disk file storage — genuinely writes and serves files, not a
 * mock. Suitable for local development and small deployments; the
 * StorageService interface is what makes swapping this for a real S3
 * client later a one-file change rather than a rewrite (see
 * storage.interface.ts's doc comment).
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly logger = new Logger(LocalStorageService.name);

  async upload({
    buffer,
    originalName,
    directory,
  }: UploadFileInput): Promise<UploadedFileResult> {
    const dir = join(UPLOADS_ROOT, directory);
    await mkdir(dir, { recursive: true });

    // A random filename, not the client-supplied originalName — avoids
    // both path traversal (a malicious "../../etc/passwd") and filename
    // collisions between different uploads. The original extension is
    // kept (sanitized to alphanumeric only) purely for readability/debugging.
    const safeExt = extname(originalName)
      .replace(/[^a-zA-Z0-9.]/g, '')
      .slice(0, 10);
    const filename = `${randomUUID()}${safeExt}`;
    const key = `${directory}/${filename}`;
    const fullPath = join(UPLOADS_ROOT, key);

    await writeFile(fullPath, buffer);
    this.logger.log(`Stored file at ${key} (${buffer.length} bytes)`);

    return { url: `/uploads/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    const fullPath = join(UPLOADS_ROOT, key);
    try {
      await unlink(fullPath);
    } catch (error) {
      // Deleting a file that's already gone shouldn't be a hard failure —
      // the end state (file doesn't exist) is what the caller wanted.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
