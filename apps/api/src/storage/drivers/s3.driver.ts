import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { StorageConfig } from '../../config/storage';
import { StorageDriver } from '../storage-driver.interface';

/**
 * S3-compatible object storage: AWS S3, Cloudflare R2, Backblaze B2, MinIO.
 *
 * Chosen over the local driver when the API has no durable disk — a container
 * platform that replaces the filesystem on every deploy, or more than one
 * instance, where two replicas writing to their own disks would each hold half
 * the case files.
 *
 * `forcePathStyle` follows the endpoint: the virtual-host addressing AWS
 * prefers is not implemented by most S3-compatible services, so a custom
 * endpoint gets path-style keys instead.
 */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: StorageConfig['s3']) {
    const missing = (['bucket', 'accessKeyId', 'secretAccessKey'] as const).filter(
      (k) => !config[k],
    );
    // Fail at boot rather than on the first upload, which would otherwise be a
    // dentist losing a scan they had already waited to send.
    if (missing.length) {
      throw new Error(
        `STORAGE_DRIVER=s3 needs ${missing
          .map((k) => `S3_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`)
          .join(', ')}`,
      );
    }

    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
    });
  }

  /**
   * Object keys carry no `.` or `..` segments. S3 treats them as literal text
   * rather than navigation, so they cannot escape the bucket — but a key that
   * reads as a traversal attempt is still a bug, and the local driver rejects
   * the same input. Keeping both strict means a path that works on one backend
   * works on the other.
   */
  private key(relativePath: string): string {
    const parts = relativePath.split('/').filter((p) => p.length > 0);
    if (parts.some((p) => p === '.' || p === '..')) {
      throw new Error(`Illegal storage path: ${relativePath}`);
    }
    return parts.join('/');
  }

  /** S3 reports a missing object as 404/NotFound depending on the operation. */
  private isNotFound(error: unknown): boolean {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
  }

  async save(relativePath: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(relativePath),
        Body: data,
        // AES256 is the one SSE mode every S3-compatible backend used here
        // (AWS, R2, B2, MinIO) accepts. A backend that doesn't support it
        // would reject the whole request rather than silently drop it, so
        // this is safe to send unconditionally.
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async read(relativePath: string): Promise<Buffer> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(relativePath) }),
    );
    if (!out.Body) throw new Error(`Empty object body: ${relativePath}`);
    return Buffer.from(await out.Body.transformToByteArray());
  }

  async createReadStream(relativePath: string): Promise<Readable> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(relativePath) }),
    );
    if (!out.Body) throw new Error(`Empty object body: ${relativePath}`);
    return out.Body as Readable;
  }

  /** Idempotent, matching the local driver's `rm --force`. */
  async delete(relativePath: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(relativePath) }),
    );
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(relativePath) }),
      );
      return true;
    } catch (error) {
      if (this.isNotFound(error)) return false;
      // A network or credentials failure is not "absent" — reporting it as
      // absent would let a caller overwrite a file that is really there.
      throw error;
    }
  }
}
