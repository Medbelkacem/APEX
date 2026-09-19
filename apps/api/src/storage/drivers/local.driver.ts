import { createReadStream, promises as fs } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { Readable } from 'stream';
import { StorageDriver } from '../storage-driver.interface';

/**
 * Local-disk storage. Files live under `root`, which is kept OUTSIDE the app's
 * web root. Every path is validated to prevent directory-traversal escapes.
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(localRoot: string) {
    this.root = resolve(process.cwd(), localRoot);
  }

  private abs(relativePath: string): string {
    const full = resolve(this.root, relativePath);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`Illegal storage path: ${relativePath}`);
    }
    return full;
  }

  async save(relativePath: string, data: Buffer): Promise<void> {
    const p = this.abs(relativePath);
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }

  async read(relativePath: string): Promise<Buffer> {
    return fs.readFile(this.abs(relativePath));
  }

  async createReadStream(relativePath: string): Promise<Readable> {
    const p = this.abs(relativePath);
    await fs.access(p); // throws ENOENT if missing, before returning the stream
    return createReadStream(p);
  }

  async delete(relativePath: string): Promise<void> {
    await fs.rm(this.abs(relativePath), { force: true });
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(this.abs(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async headSize(relativePath: string): Promise<number | null> {
    try {
      const stat = await fs.stat(this.abs(relativePath));
      return stat.size;
    } catch {
      return null;
    }
  }

  async readPrefix(relativePath: string, length: number): Promise<Buffer> {
    const handle = await fs.open(this.abs(relativePath), 'r');
    try {
      const buf = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buf, 0, length, 0);
      return buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  // No presignPut/presignGet: local disk has no public HTTP endpoint of its
  // own to hand out a direct-upload/download URL for. Dev keeps using the
  // proxied multipart upload and streamed download instead — see
  // CaseFilesService's driver-capability check.

  /** Exposed for join operations by callers that need the concrete root. */
  static join(...parts: string[]): string {
    return join(...parts);
  }
}
