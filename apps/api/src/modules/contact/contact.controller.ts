import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { UserRole } from '@dental/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ContactService } from './contact.service';
import { CreateContactDto, ListContactDto } from './contact.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Public()
  @Post()
  @HttpCode(201)
  // Rate-limit the public form: max 5 submissions per minute per IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit the public contact form.' })
  async submit(@Body() dto: CreateContactDto, @Req() req: Request) {
    const ip = req.ip ?? null;
    await this.contact.create(dto, ip);
    return { message: 'Thank you — we will get back to you shortly.' };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List contact messages (admin).' })
  list(@Query() query: ListContactDto) {
    return this.contact.list(query);
  }

  @Post(':id/handle')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark a contact message as handled (admin).' })
  handle(@Param('id', ParseUUIDPipe) id: string) {
    return this.contact.markHandled(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a contact message (admin).' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.contact.remove(id);
    return { success: true };
  }
}
