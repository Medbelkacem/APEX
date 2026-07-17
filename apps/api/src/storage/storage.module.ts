import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfig } from '../config/storage';
import { StorageService } from './storage.service';
import { STORAGE_DRIVER } from './storage-driver.interface';
import { LocalStorageDriver } from './drivers/local.driver';
import { S3StorageDriver } from './drivers/s3.driver';

/** Provides the configured storage driver + high-level StorageService. Global. */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const storage = config.get<StorageConfig>('storage')!;
        return storage.driver === 's3'
          ? new S3StorageDriver(storage.s3)
          : new LocalStorageDriver(storage.localRoot);
      },
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_DRIVER],
})
export class StorageModule {}
