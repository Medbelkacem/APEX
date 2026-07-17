import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactMessage } from '../../database/entities';
import { ContactService } from './contact.service';
import { ContactController } from './contact.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContactMessage])],
  providers: [ContactService],
  controllers: [ContactController],
  exports: [ContactService],
})
export class ContactModule {}
