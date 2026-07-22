import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticatedUser, UserRole } from '@dental/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { CasesService } from './cases.service';
import { CaseFilesService, IncomingFile } from './case-files.service';
import {
  ChangeStatusDto,
  CreateCaseDto,
  ListCasesDto,
  ReassignCaseDto,
  UpdateCaseDto,
  UploadFilesDto,
} from './cases.dto';

/** Maximum attachments accepted in a single multipart request. */
const MAX_FILES_PER_REQUEST = 20;

/**
 * Hard per-part byte ceiling handed to multer, matching MAX_UPLOAD_MB's default
 * so multer aborts an oversized part before buffering it into memory. The
 * per-category caps (image/document) are still enforced in validateUpload; this
 * is only the coarse guard that keeps a 20×huge-file POST from exhausting RAM.
 */
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024;

/**
 * Build a safe Content-Disposition value. The ASCII fallback drops control
 * characters — which would otherwise make `res.setHeader` throw and 500 the
 * download — along with quotes and backslashes; `filename*` carries the real,
 * possibly non-ASCII name percent-encoded per RFC 5987/6266 for clients that
 * understand it.
 */
function contentDisposition(name: string): string {
  const asciiFallback =
    name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '').trim() || 'download';
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

@ApiTags('cases')
@Controller('cases')
export class CasesController {
  private readonly logger = new Logger(CasesController.name);

  constructor(
    private readonly cases: CasesService,
    private readonly caseFiles: CaseFilesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List cases — dentists see only their own.' })
  list(@Query() query: ListCasesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.list(query, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Dashboard counters for the current user.' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.cases.summary(user);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Most recent cases for the dashboard feed.' })
  recent(@CurrentUser() user: AuthenticatedUser, @Query('take') take?: string) {
    const parsed = Number(take);
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 20) : 5;
    return this.cases.recent(user, limit);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new case.' })
  async create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthenticatedUser) {
    const created = await this.cases.create(dto, user);
    await this.audit.record({
      userId: user.id,
      action: 'case.created',
      entityType: 'case',
      entityId: created.id,
      metadata: { reference: created.reference },
    });
    return created;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Case detail.' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.findScoped(id, user);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Status-change history for a case.' })
  timeline(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.timeline(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update case details.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cases.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Advance a case through the workflow.' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.cases.changeStatus(id, dto, user);
    await this.audit.record({
      userId: user.id,
      action: 'case.status_changed',
      entityType: 'case',
      entityId: id,
      metadata: { statusId: dto.caseStatusId, note: dto.note ?? null },
    });
    return updated;
  }

  @Post(':id/reassign')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Move a case to a different dentist.' })
  async reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignCaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.cases.reassign(id, dto, user);
    await this.audit.record({
      userId: user.id,
      action: 'case.reassigned',
      entityType: 'case',
      entityId: id,
      metadata: { dentistId: dto.dentistId },
    });
    return updated;
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  @Get(':id/files')
  @ApiOperation({ summary: 'List files attached to a case.' })
  listFiles(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.caseFiles.list(id, user);
  }

  @Post(':id/files')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FILES_PER_REQUEST },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        fileType: { type: 'string', enum: ['stl', 'image', 'document', 'lab_output'] },
      },
    },
  })
  @ApiOperation({ summary: 'Upload one or more files to a case.' })
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: IncomingFile[] | undefined,
    @Body() dto: UploadFilesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!files?.length) throw new BadRequestException('No files were provided');
    const saved = await this.caseFiles.upload(id, files, user, dto.fileType);
    await this.audit.record({
      userId: user.id,
      action: 'case.files_uploaded',
      entityType: 'case',
      entityId: id,
      metadata: { count: saved.length, names: saved.map((f) => f.originalFilename) },
    });
    return saved;
  }

  @Get(':id/files/:fileId')
  @ApiOperation({ summary: 'Download a case file (streamed).' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { file, stream } = await this.caseFiles.openForDownload(id, fileId, user);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    res.setHeader('Content-Disposition', contentDisposition(file.originalFilename));

    // A read error after the existence check — the blob deleted mid-stream, an
    // I/O fault — would otherwise reach an unhandled 'error' on the source and
    // take the whole process down. And a client that aborts the download leaves
    // the file descriptor open unless the source is destroyed with the response.
    stream.on('error', (err) => {
      this.logger.error(`Streaming file ${fileId} for case ${id}: ${String(err)}`);
      if (!res.headersSent) res.status(500);
      res.destroy();
    });
    res.on('close', () => stream.destroy());

    stream.pipe(res);
  }

  @Delete(':id/files/:fileId')
  @ApiOperation({ summary: 'Remove a case file.' })
  async removeFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.caseFiles.remove(id, fileId, user);
    return { success: true };
  }
}
