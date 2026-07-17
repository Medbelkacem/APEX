import { Readable } from 'stream';

/**
 * Storage backend contract. Paths are always relative to the backend root
 * (e.g. `cases/<id>/<file>.stl`); the driver resolves them to absolute keys.
 */
export interface StorageDriver {
  save(relativePath: string, data: Buffer): Promise<void>;
  read(relativePath: string): Promise<Buffer>;
  createReadStream(relativePath: string): Promise<Readable>;
  delete(relativePath: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
