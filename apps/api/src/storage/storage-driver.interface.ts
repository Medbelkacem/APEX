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
  /** Byte length of a stored object, or null if it does not exist yet. */
  headSize(relativePath: string): Promise<number | null>;
  /**
   * The first `length` bytes of a stored object — enough to magic-byte-sniff
   * a large file (e.g. a 40 MB STL scan) without reading all of it.
   */
  readPrefix(relativePath: string, length: number): Promise<Buffer>;
  /**
   * A time-limited URL the browser can `PUT` bytes to directly, bypassing the
   * API entirely — required once a file can be larger than the API's own
   * request-body ceiling. Undefined on a driver with no public HTTP endpoint
   * of its own (the local-disk driver used in dev).
   */
  presignPut?(relativePath: string, contentType: string, expiresInSeconds: number): Promise<string>;
  /** A time-limited URL the browser can `GET` the object from directly. */
  presignGet?(
    relativePath: string,
    downloadFilename: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<string>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
