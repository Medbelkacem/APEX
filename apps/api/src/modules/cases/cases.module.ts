import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { CaseFile, CaseStatusHistory, DentalCase, Dentist } from '../../database/entities';
import { StorageConfig } from '../../config/storage';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CasesService } from './cases.service';
import { CaseFilesService } from './case-files.service';
import { CasesController } from './cases.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DentalCase, CaseStatusHistory, CaseFile, Dentist]),
    // Uploads are buffered in memory so the magic-byte sniff can run before
    // anything touches disk; the hard cap here is a backstop — per-category
    // limits are enforced in file-validation.ts.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.get<StorageConfig>('storage')!.maxUploadBytes },
      }),
    }),
    CatalogModule,
    NotificationsModule,
  ],
  providers: [CasesService, CaseFilesService],
  controllers: [CasesController],
  exports: [CasesService, CaseFilesService],
})
export class CasesModule {}
