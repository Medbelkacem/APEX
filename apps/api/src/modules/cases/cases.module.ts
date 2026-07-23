import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import {
  CaseFile,
  CaseFileSchema,
  CaseStatusHistory,
  CaseStatusHistorySchema,
  Counter,
  CounterSchema,
  DentalCase,
  DentalCaseSchema,
  Dentist,
  DentistSchema,
} from '../../database/entities';
import { StorageConfig } from '../../config/storage';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CasesService } from './cases.service';
import { CaseFilesService } from './case-files.service';
import { CasesController } from './cases.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DentalCase.name, schema: DentalCaseSchema },
      { name: CaseStatusHistory.name, schema: CaseStatusHistorySchema },
      { name: CaseFile.name, schema: CaseFileSchema },
      { name: Dentist.name, schema: DentistSchema },
      { name: Counter.name, schema: CounterSchema },
    ]),
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
