import { randomUUID } from 'crypto';
import { join, extname, resolve, sep } from 'path';
import { mkdir, unlink, writeFile, access } from 'fs/promises';
import { createReadStream } from 'fs';
import type { Readable } from 'stream';
import { NotFoundException, Injectable, Logger } from '@nestjs/common';
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

    // P0-D — `/api/uploads/...`, not the bare `/uploads/...` this
    // returned before: nothing served that path (a dead link, the
    // original P0-C finding), and even once FilesController below
    // fixed that on the backend, the frontend's own proxy config
    // (apps/web/vite.config.ts locally, vercel.json in production)
    // only forwards `/api/*` to this API — a bare `/uploads/...` URL
    // would 404 (dev) or hit the SPA fallback (prod) regardless of
    // what the backend does. No migration needed for existing stored
    // URLs: confirmed via the storage audit that no uploaded file
    // survives a redeploy under the current ephemeral-disk deployment
    // anyway, so there is no real production data this could break.
    return { url: `/api/uploads/${key}`, key };
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

  async createReadStream(key: string): Promise<Readable> {
    // P0-D — `key` here ultimately traces back to a client-supplied
    // route param (FilesController), unlike every other call site in
    // this class, which only ever sees a server-generated UUID key.
    // path.join alone doesn't stop `..` segments from escaping
    // UPLOADS_ROOT, so this resolves the real final path and rejects
    // anything that lands outside it, on top of FilesController's own
    // upstream rejection of any filename containing `..` or `/` —
    // defense in depth, not redundant: this is the layer that would
    // still hold if that upstream check were ever removed or bypassed.
    const fullPath = resolve(UPLOADS_ROOT, key);
    if (fullPath !== UPLOADS_ROOT && !fullPath.startsWith(UPLOADS_ROOT + sep)) {
      throw new NotFoundException('File not found.');
    }
    try {
      await access(fullPath);
    } catch {
      throw new NotFoundException('File not found.');
    }
    return createReadStream(fullPath);
  }
}
