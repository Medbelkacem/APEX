import { S3StorageDriver } from './s3.driver';
import { StorageConfig } from '../../config/storage';

/**
 * Covers the two things that need no network: the boot-time config check and
 * the path guard. The command round trips are the SDK's own responsibility.
 */
const config = (over: Partial<StorageConfig['s3']> = {}): StorageConfig['s3'] => ({
  endpoint: '',
  region: 'us-east-1',
  bucket: 'apex-files',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  ...over,
});

describe('S3StorageDriver', () => {
  describe('configuration', () => {
    it('constructs when bucket and credentials are present', () => {
      expect(() => new S3StorageDriver(config())).not.toThrow();
    });

    it('also constructs without throwing when credentials are missing — the whole API must still boot', () => {
      expect(
        () => new S3StorageDriver(config({ bucket: '', accessKeyId: '', secretAccessKey: '' })),
      ).not.toThrow();
    });

    it.each([
      ['bucket', 'S3_BUCKET'],
      ['accessKeyId', 'S3_ACCESS_KEY_ID'],
      ['secretAccessKey', 'S3_SECRET_ACCESS_KEY'],
    ] as const)('refuses the first real operation without %s, naming the variable', async (field, variable) => {
      const driver = new S3StorageDriver(config({ [field]: '' }));
      await expect(driver.exists('cases/abc/scan.stl')).rejects.toThrow(variable);
    });

    it('names every missing variable at once rather than one per attempt', async () => {
      const driver = new S3StorageDriver(config({ bucket: '', accessKeyId: '', secretAccessKey: '' }));
      await expect(driver.exists('cases/abc/scan.stl')).rejects.toThrow(
        /S3_BUCKET.*S3_ACCESS_KEY_ID.*S3_SECRET_ACCESS_KEY/,
      );
    });
  });

  describe('key derivation', () => {
    // `key` is private; exercised through the public surface it guards.
    const keyOf = (driver: S3StorageDriver, path: string) =>
      (driver as unknown as { key(p: string): string }).key(path);

    it('strips empty segments so a stray slash does not change the key', () => {
      const driver = new S3StorageDriver(config());
      expect(keyOf(driver, 'cases//abc/scan.stl')).toBe('cases/abc/scan.stl');
      expect(keyOf(driver, '/cases/abc/scan.stl')).toBe('cases/abc/scan.stl');
    });

    it.each(['../secrets', 'cases/../../etc/passwd', 'cases/./abc', '..'])(
      'rejects %s, matching the local driver',
      (path) => {
        const driver = new S3StorageDriver(config());
        expect(() => keyOf(driver, path)).toThrow('Illegal storage path');
      },
    );
  });

  describe('presigned URLs', () => {
    // getSignedUrl computes the signature locally (SigV4) — no network call,
    // so these are as fast and deterministic as the rest of this file.
    it('presignPut signs a PUT to the right bucket/key and expires', async () => {
      const driver = new S3StorageDriver(config({ bucket: 'apex-files' }));
      const url = await driver.presignPut('cases/abc/scan.stl', 'model/stl', 900);
      expect(url).toContain('apex-files');
      expect(url).toContain('cases/abc/scan.stl');
      expect(url).toMatch(/X-Amz-Expires=900/);
      expect(url).toMatch(/X-Amz-Signature=/);
    });

    it('presignGet carries the response Content-Type and a download filename', async () => {
      const driver = new S3StorageDriver(config({ bucket: 'apex-files' }));
      const url = await driver.presignGet('cases/abc/scan.stl', 'patient scan.stl', 'model/stl', 900);
      expect(url).toContain('cases/abc/scan.stl');
      expect(decodeURIComponent(url)).toContain('response-content-disposition');
      expect(decodeURIComponent(url)).toContain('patient scan.stl');
      expect(decodeURIComponent(url)).toContain('response-content-type=model/stl');
    });

    it('signs with SigV4, carrying a date and credential scope', async () => {
      const driver = new S3StorageDriver(config());
      const url = await driver.presignPut('cases/abc/scan.stl', 'model/stl', 900);
      expect(url).toMatch(/X-Amz-Algorithm=AWS4-HMAC-SHA256/);
      expect(url).toMatch(/X-Amz-Date=\d{8}T\d{6}Z/);
      expect(url).toMatch(/X-Amz-Credential=/);
    });
  });
});
