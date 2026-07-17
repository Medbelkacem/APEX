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

  /** Exposed for join operations by callers that need the concrete root. */
  static join(...parts: string[]): string {
    return join(...parts);
  }
}
