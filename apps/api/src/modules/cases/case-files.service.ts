import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { AuthenticatedUser, CaseFileType, UserRole } from '@dental/shared-types';
import { CaseFile } from '../../database/entities';
import { StorageConfig } from '../../config/storage';
import { StorageService } from '../../storage/storage.service';
import { CasesService } from './cases.service';
import { UploadLimits, validateUpload } from './file-validation';

/** The subset of Express.Multer.File this service relies on. */
export interface IncomingFile {
  originalname: string;
  buffer: Buffer;
}

@Injectable()
export class CaseFilesService {
  constructor(
    @InjectRepository(CaseFile) private readonly files: Repository<CaseFile>,
    private readonly storage: StorageService,
    private readonly cases: CasesService,
    private readonly config: ConfigService,
  ) {}

  private get limits(): UploadLimits {
    const { maxUploadBytes, maxImageBytes, maxDocumentBytes } =
      this.config.get<StorageConfig>('storage')!;
    return { maxUploadBytes, maxImageBytes, maxDocumentBytes };
  }

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }

  async list(caseId: string, user: AuthenticatedUser): Promise<CaseFile[]> {
    await this.cases.findScoped(caseId, user);
    return this.files.find({
      where: { caseId },
      relations: { uploadedByUser: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Validate and persist uploads. Files are written to storage first, then
   * recorded in the database — a failed DB write leaves an orphan blob, which
   * is harmless, whereas the reverse would leave a row pointing at nothing.
   */
  async upload(
    caseId: string,
    incoming: IncomingFile[],
    user: AuthenticatedUser,
    fileTypeHint?: CaseFileType,
  ): Promise<CaseFile[]> {
    const entity = await this.cases.findScoped(caseId, user);

    // Only the lab may attach deliverables; a dentist's uploads are submissions.
    if (fileTypeHint === CaseFileType.LAB_OUTPUT && !this.isAdmin(user)) {
      throw new ForbiddenException('Only laboratory staff can attach lab output files');
    }

    const saved: CaseFile[] = [];
    for (const file of incoming) {
      const validated = validateUpload(file.originalname, file.buffer, this.limits);
      const { path } = this.storage.buildCaseFilePath(entity.id, validated.extension);
      await this.storage.save(path, file.buffer);

      saved.push(
        await this.files.save(
          this.files.create({
            caseId: entity.id,
            fileType: fileTypeHint ?? validated.fileType,
            originalFilename: file.originalname,
            storedPath: path,
            mimeType: validated.mimeType,
            sizeBytes: file.buffer.length,
            uploadedByUserId: user.id,
          }),
        ),
      );
    }
    return saved;
  }

  /** Resolve a file for download, enforcing case-level access. */
  async openForDownload(
    caseId: string,
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<{ file: CaseFile; stream: Readable }> {
    await this.cases.findScoped(caseId, user);
    const file = await this.files.findOne({ where: { id: fileId, caseId } });
    if (!file) throw new NotFoundException('File not found');

    if (!(await this.storage.exists(file.storedPath))) {
      throw new NotFoundException('The stored file is no longer available');
    }
    return { file, stream: await this.storage.stream(file.storedPath) };
  }

  /**
   * Remove an attachment. Dentists may only withdraw their own submissions and
   * never a lab deliverable; admins may remove anything.
   */
  async remove(caseId: string, fileId: string, user: AuthenticatedUser): Promise<void> {
    await this.cases.findScoped(caseId, user);
    const file = await this.files.findOne({ where: { id: fileId, caseId } });
    if (!file) throw new NotFoundException('File not found');

    if (!this.isAdmin(user)) {
      if (file.fileType === CaseFileType.LAB_OUTPUT || file.uploadedByUserId !== user.id) {
        throw new ForbiddenException('You can only remove files you uploaded');
      }
    }

    await this.files.delete(file.id);
    // Best-effort blob cleanup — the row is already gone, so a storage hiccup
    // must not surface as a failed request.
    await this.storage.delete(file.storedPath).catch(() => undefined);
  }
}
