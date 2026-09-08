import { join } from 'path';
import { access, readFile, rm } from 'fs/promises';
import { LocalStorageService } from './local-storage.service';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');

describe('LocalStorageService (real filesystem I/O)', () => {
  const service = new LocalStorageService();
  const testDir = 'test-avatars';

  afterAll(async () => {
    await rm(join(UPLOADS_ROOT, testDir), { recursive: true, force: true });
  });

  it('writes a real file to disk and returns a matching URL', async () => {
    const buffer = Buffer.from('fake image bytes');
    const result = await service.upload({
      buffer,
      originalName: 'photo.png',
      mimetype: 'image/png',
      directory: testDir,
    });

    expect(result.url).toBe(`/api/uploads/${result.key}`);
    expect(result.key).toMatch(new RegExp(`^${testDir}/[a-f0-9-]+\\.png$`));

    const written = await readFile(join(UPLOADS_ROOT, result.key));
    expect(written.equals(buffer)).toBe(true);
  });

  it('sanitizes a path-traversal attempt in the original filename', async () => {
    const result = await service.upload({
      buffer: Buffer.from('x'),
      originalName: '../../../etc/passwd',
      mimetype: 'image/png',
      directory: testDir,
    });

    // The generated key must stay confined to the intended directory —
    // no ../ segments should survive into the stored key.
    expect(result.key.startsWith(`${testDir}/`)).toBe(true);
    expect(result.key).not.toContain('..');
  });

  it('generates a different key for every upload, even with the same filename', async () => {
    const first = await service.upload({
      buffer: Buffer.from('a'),
      originalName: 'same.png',
      mimetype: 'image/png',
      directory: testDir,
    });
    const second = await service.upload({
      buffer: Buffer.from('b'),
      originalName: 'same.png',
      mimetype: 'image/png',
      directory: testDir,
    });
    expect(first.key).not.toBe(second.key);
  });

  it('actually deletes a file from disk', async () => {
    const result = await service.upload({
      buffer: Buffer.from('to-delete'),
      originalName: 'x.png',
      mimetype: 'image/png',
      directory: testDir,
    });
    const fullPath = join(UPLOADS_ROOT, result.key);
    await expect(access(fullPath)).resolves.toBeUndefined();

    await service.delete(result.key);
    await expect(access(fullPath)).rejects.toThrow();
  });

  it('does not throw when deleting a file that does not exist', async () => {
    await expect(
      service.delete(`${testDir}/does-not-exist.png`),
    ).resolves.toBeUndefined();
  });

  describe('createReadStream', () => {
    it('streams back the exact bytes that were uploaded', async () => {
      const buffer = Buffer.from('round-trip content');
      const { key } = await service.upload({
        buffer,
        originalName: 'roundtrip.png',
        mimetype: 'image/png',
        directory: testDir,
      });

      const stream = await service.createReadStream(key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      expect(Buffer.concat(chunks).equals(buffer)).toBe(true);
    });

    it('rejects with NotFoundException for a key that does not exist', async () => {
      await expect(
        service.createReadStream(`${testDir}/does-not-exist.png`),
      ).rejects.toThrow('File not found.');
    });

    it('rejects a path-traversal attempt instead of escaping UPLOADS_ROOT', async () => {
      // P0-D — this is the layer that matters if FilesController's own
      // upstream filename check is ever bypassed or removed; assert it
      // independently, not just via the controller.
      await expect(
        service.createReadStream('../../../../etc/passwd'),
      ).rejects.toThrow('File not found.');
    });
  });
});
