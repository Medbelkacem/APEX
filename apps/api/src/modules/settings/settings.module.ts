import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformSetting, PlatformSettingSchema } from '../../database/entities';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

/** Global: billing, branding, and integration settings are read platform-wide. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: PlatformSetting.name, schema: PlatformSettingSchema }]),
  ],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
