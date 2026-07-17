import { Readable } from 'stream';
import { StorageConfig } from '../../config/storage';
import { StorageDriver } from '../storage-driver.interface';

/**
 * S3-compatible driver placeholder. The abstraction exists from day one (DRS
 * requirement) so switching STORAGE_DRIVER=s3 later needs no changes outside
 * this file — implement these methods with @aws-sdk/client-s3 when adopted.
 */
export class S3StorageDriver implements StorageDriver {
  constructor(private readonly config: StorageConfig['s3']) {}

  private notImplemented(): never {
    throw new Error(
      'S3 storage driver is not implemented yet. Add @aws-sdk/client-s3 and implement S3StorageDriver, or set STORAGE_DRIVER=local.',
    );
  }

  save(): Promise<void> {
    return this.notImplemented();
  }
  read(): Promise<Buffer> {
    return this.notImplemented();
  }
  createReadStream(): Promise<Readable> {
    return this.notImplemented();
  }
  delete(): Promise<void> {
    return this.notImplemented();
  }
  exists(): Promise<boolean> {
    return this.notImplemented();
  }
}
