import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { StorageConfig } from '../../config/storage';
import { StorageDriver } from '../storage-driver.interface';
import { contentDisposition } from '../../common/utils/content-disposition';

/** How long a presigned PUT/GET URL stays valid — long enough for a slow mobile upload, short enough not to matter if leaked. */
const PRESIGN_EXPIRY_SECONDS = 15 * 60;
/** Bounds every B2/S3 call so a network stall degrades to a clear error instead of hanging out a request for however long the platform allows. */
const REQUEST_TIMEOUT_MS = 10_000;

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
  private readonly missingConfig: string[];

  /**
   * Credentials are checked lazily, on first real operation, not here.
   * Failing at boot over a config gap (no B2 keys supplied yet) would take
   * the *entire* API down — including every route that has nothing to do
   * with file storage — rather than just the upload/download endpoints that
   * actually need them.
   */
  constructor(private readonly config: StorageConfig['s3']) {
    this.missingConfig = (['bucket', 'accessKeyId', 'secretAccessKey'] as const)
      .filter((k) => !config[k])
      .map((k) => `S3_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);

    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      requestHandler: new NodeHttpHandler({
        connectionTimeout: REQUEST_TIMEOUT_MS,
        requestTimeout: REQUEST_TIMEOUT_MS,
      }),
    });
  }

  /** Throws a clear, JSON-friendly error the first time storage is actually used without full config — not at boot. */
  private ensureConfigured(): void {
    if (this.missingConfig.length) {
      throw new Error(`File storage is not configured — missing ${this.missingConfig.join(', ')}`);
    }
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
    this.ensureConfigured();
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
    this.ensureConfigured();
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(relativePath) }),
    );
    if (!out.Body) throw new Error(`Empty object body: ${relativePath}`);
    return Buffer.from(await out.Body.transformToByteArray());
  }

  async createReadStream(relativePath: string): Promise<Readable> {
    this.ensureConfigured();
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.key(relativePath) }),
    );
    if (!out.Body) throw new Error(`Empty object body: ${relativePath}`);
    return out.Body as Readable;
  }

  /** Idempotent, matching the local driver's `rm --force`. */
  async delete(relativePath: string): Promise<void> {
    this.ensureConfigured();
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(relativePath) }),
    );
  }

  async exists(relativePath: string): Promise<boolean> {
    this.ensureConfigured();
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

  async headSize(relativePath: string): Promise<number | null> {
    this.ensureConfigured();
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(relativePath) }),
      );
      return out.ContentLength ?? null;
    } catch (error) {
      if (this.isNotFound(error)) return null;
      throw error;
    }
  }

  /** A ranged GET — enough bytes to sniff a format without downloading a large object in full. */
  async readPrefix(relativePath: string, length: number): Promise<Buffer> {
    this.ensureConfigured();
    const out = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.key(relativePath),
        Range: `bytes=0-${length - 1}`,
      }),
    );
    if (!out.Body) throw new Error(`Empty object body: ${relativePath}`);
    return Buffer.from(await out.Body.transformToByteArray());
  }

  async presignPut(
    relativePath: string,
    contentType: string,
    expiresInSeconds = PRESIGN_EXPIRY_SECONDS,
  ): Promise<string> {
    this.ensureConfigured();
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.key(relativePath),
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async presignGet(
    relativePath: string,
    downloadFilename: string,
    mimeType: string,
    expiresInSeconds = PRESIGN_EXPIRY_SECONDS,
  ): Promise<string> {
    this.ensureConfigured();
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.key(relativePath),
      ResponseContentType: mimeType,
      ResponseContentDisposition: contentDisposition(downloadFilename),
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
