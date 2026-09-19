import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Readable } from 'stream';
import { AuthenticatedUser, CaseFileType, UserRole } from '@dental/shared-types';
import { CaseFile } from '../../database/entities';
import { StorageConfig } from '../../config/storage';
import { StorageService } from '../../storage/storage.service';
import { CasesService } from './cases.service';
import { UploadLimits, validateDeclaredUpload, validateFormat, validateUpload } from './file-validation';

/** Bytes fetched from the front of a stored object to magic-byte-sniff it without downloading it in full. */
const SNIFF_PREFIX_BYTES = 512;

/** The subset of Express.Multer.File this service relies on. */
export interface IncomingFile {
  originalname: string;
  buffer: Buffer;
}

@Injectable()
export class CaseFilesService {
  constructor(
    @InjectModel(CaseFile.name) private readonly files: Model<CaseFile>,
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
    return this.files.find({ caseId }).populate('uploadedByUser').sort({ createdAt: 1 }).exec();
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

    // Validate every file up front, before a single byte is written. Validating
    // and saving in one pass meant a bad file part-way through a batch left the
    // files before it already stored and recorded, while the request still
    // failed — so a re-upload duplicated them, with no audit trail for either.
    const validated = incoming.map((file) => ({
      file,
      spec: validateUpload(file.originalname, file.buffer, this.limits),
    }));

    const saved: CaseFile[] = [];
    for (const { file, spec } of validated) {
      const { path } = this.storage.buildCaseFilePath(entity.id, spec.extension);
      await this.storage.save(path, file.buffer);

      saved.push(
        await this.files.create({
          caseId: entity.id,
          fileType: fileTypeHint ?? spec.fileType,
          originalFilename: file.originalname,
          storedPath: path,
          mimeType: spec.mimeType,
          sizeBytes: file.buffer.length,
          uploadedByUserId: user.id,
        }),
      );
    }
    return saved;
  }

  /** Whether this deployment can hand out direct browser↔storage URLs at all (S3-compatible drivers only). */
  supportsDirectTransfer(): boolean {
    return this.storage.supportsPresignedUrls();
  }

  /**
   * Issue presigned direct-to-storage upload URLs. No bytes pass through the
   * API here — only the filename and the caller's *claimed* size, checked
   * against the extension allow-list and size cap up front. The magic-byte
   * check that catches a mislabeled or malicious file happens in
   * `finalizeUpload`, once the bytes actually exist in storage to inspect.
   */
  async presignUpload(
    caseId: string,
    requests: { filename: string; sizeBytes: number }[],
    user: AuthenticatedUser,
    fileTypeHint?: CaseFileType,
  ): Promise<{ path: string; filename: string; uploadUrl: string; mimeType: string }[]> {
    const entity = await this.cases.findScoped(caseId, user);

    if (fileTypeHint === CaseFileType.LAB_OUTPUT && !this.isAdmin(user)) {
      throw new ForbiddenException('Only laboratory staff can attach lab output files');
    }
    if (!this.storage.supportsPresignedUrls()) {
      throw new BadRequestException('Direct upload is not available on this deployment');
    }

    return Promise.all(
      requests.map(async (req) => {
        const spec = validateDeclaredUpload(req.filename, req.sizeBytes, this.limits);
        const { path } = this.storage.buildCaseFilePath(entity.id, spec.extension);
        const uploadUrl = await this.storage.presignPut(path, spec.mimeType);
        // The client must PUT with this exact Content-Type — it is part of
        // what was just signed, so anything else fails the signature check.
        return { path, filename: req.filename, uploadUrl, mimeType: spec.mimeType };
      }),
    );
  }

  /**
   * Confirm a batch of presigned uploads actually landed and are what they
   * claimed to be, then record them. Any file that fails validation here is
   * deleted from storage rather than left as an unvalidated orphan blob.
   */
  async finalizeUpload(
    caseId: string,
    incoming: { path: string; filename: string }[],
    user: AuthenticatedUser,
    fileTypeHint?: CaseFileType,
  ): Promise<CaseFile[]> {
    const entity = await this.cases.findScoped(caseId, user);

    if (fileTypeHint === CaseFileType.LAB_OUTPUT && !this.isAdmin(user)) {
      throw new ForbiddenException('Only laboratory staff can attach lab output files');
    }

    const saved: CaseFile[] = [];
    for (const item of incoming) {
      // The path must be one this case's presign step could have issued —
      // never trust a client-supplied storage key otherwise.
      if (!item.path.startsWith(`cases/${entity.id}/`)) {
        throw new ForbiddenException(`"${item.filename}" does not belong to this case`);
      }

      const totalLength = await this.storage.headSize(item.path);
      if (totalLength === null) {
        throw new BadRequestException(
          `"${item.filename}" was not found in storage — the upload may not have completed`,
        );
      }

      let spec;
      try {
        const prefix = await this.storage.readPrefix(item.path, SNIFF_PREFIX_BYTES);
        spec = validateFormat(item.filename, prefix, totalLength, this.limits);
      } catch (err) {
        await this.storage.delete(item.path).catch(() => undefined);
        throw err;
      }

      saved.push(
        await this.files.create({
          caseId: entity.id,
          fileType: fileTypeHint ?? spec.fileType,
          originalFilename: item.filename,
          storedPath: item.path,
          mimeType: spec.mimeType,
          sizeBytes: totalLength,
          uploadedByUserId: user.id,
        }),
      );
    }
    return saved;
  }

  /** A time-limited URL the browser can download a file from directly, bypassing the API. */
  async presignDownloadUrl(caseId: string, fileId: string, user: AuthenticatedUser): Promise<string> {
    await this.cases.findScoped(caseId, user);
    const file = await this.files.findOne({ _id: fileId, caseId }).exec();
    if (!file) throw new NotFoundException('File not found');
    if (!this.storage.supportsPresignedUrls()) {
      throw new NotFoundException('Direct download is not available on this deployment');
    }
    if (!(await this.storage.exists(file.storedPath))) {
      throw new NotFoundException('The stored file is no longer available');
    }
    return this.storage.presignGet(file.storedPath, file.originalFilename, file.mimeType);
  }

  /** Resolve a file for download, enforcing case-level access. */
  async openForDownload(
    caseId: string,
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<{ file: CaseFile; stream: Readable }> {
    await this.cases.findScoped(caseId, user);
    const file = await this.files.findOne({ _id: fileId, caseId }).exec();
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
    const file = await this.files.findOne({ _id: fileId, caseId }).exec();
    if (!file) throw new NotFoundException('File not found');

    if (!this.isAdmin(user)) {
      if (file.fileType === CaseFileType.LAB_OUTPUT || file.uploadedByUserId !== user.id) {
        throw new ForbiddenException('You can only remove files you uploaded');
      }
    }

    await this.files.deleteOne({ _id: file.id }).exec();
    // Best-effort blob cleanup — the row is already gone, so a storage hiccup
    // must not surface as a failed request.
    await this.storage.delete(file.storedPath).catch(() => undefined);
  }
}
