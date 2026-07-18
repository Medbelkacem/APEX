import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSetting } from '../../database/entities';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

/** Global: billing, branding, and integration settings are read platform-wide. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting])],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
