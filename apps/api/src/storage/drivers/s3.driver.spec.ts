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

    it.each([
      ['bucket', 'S3_BUCKET'],
      ['accessKeyId', 'S3_ACCESS_KEY_ID'],
      ['secretAccessKey', 'S3_SECRET_ACCESS_KEY'],
    ] as const)('refuses to start without %s, naming the variable', (field, variable) => {
      expect(() => new S3StorageDriver(config({ [field]: '' }))).toThrow(variable);
    });

    it('names every missing variable at once rather than one per restart', () => {
      expect(
        () => new S3StorageDriver(config({ bucket: '', accessKeyId: '', secretAccessKey: '' })),
      ).toThrow(/S3_BUCKET.*S3_ACCESS_KEY_ID.*S3_SECRET_ACCESS_KEY/);
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
});
