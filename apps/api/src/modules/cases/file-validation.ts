import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { CaseFileType } from '@dental/shared-types';

/** Per-category size caps, in bytes — matching the shape of StorageConfig. */
export interface UploadLimits {
  maxUploadBytes: number;
  maxImageBytes: number;
  maxDocumentBytes: number;
}

interface FormatSpec {
  extensions: string[];
  mimeType: string;
  fileType: CaseFileType;
  limitKey: keyof UploadLimits;
  /**
   * Verify the file's magic bytes actually match the claimed format. Takes a
   * `prefix` (the first N bytes — the whole file, for a small in-memory
   * upload, or just enough of a large one fetched with an HTTP Range request)
   * plus the file's true `totalLength`, since some formats (binary STL) need
   * the overall size to validate, not just the header.
   */
  sniff: (prefix: Buffer, totalLength: number) => boolean;
}

/**
 * A binary STL is an 80-byte header, a uint32 triangle count, then exactly
 * 50 bytes per triangle — checking that arithmetic is a far stronger signal
 * than any header string. ASCII STL simply starts with "solid".
 */
function isStl(prefix: Buffer, totalLength: number): boolean {
  if (totalLength >= 84 && prefix.length >= 84) {
    const triangles = prefix.readUInt32LE(80);
    if (totalLength === 84 + triangles * 50) return true;
  }
  const head = prefix.subarray(0, 6).toString('ascii').trimStart().toLowerCase();
  return head.startsWith('solid');
}

const FORMATS: FormatSpec[] = [
  {
    extensions: ['.stl'],
    mimeType: 'model/stl',
    fileType: CaseFileType.STL,
    limitKey: 'maxUploadBytes',
    sniff: isStl,
  },
  {
    extensions: ['.png'],
    mimeType: 'image/png',
    fileType: CaseFileType.IMAGE,
    limitKey: 'maxImageBytes',
    sniff: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    extensions: ['.jpg', '.jpeg'],
    mimeType: 'image/jpeg',
    fileType: CaseFileType.IMAGE,
    limitKey: 'maxImageBytes',
    sniff: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    extensions: ['.pdf'],
    mimeType: 'application/pdf',
    fileType: CaseFileType.DOCUMENT,
    limitKey: 'maxDocumentBytes',
    sniff: (b) => b.subarray(0, 5).toString('ascii') === '%PDF-',
  },
];

export const ALLOWED_EXTENSIONS = FORMATS.flatMap((f) => f.extensions);

export interface ValidatedFile {
  fileType: CaseFileType;
  mimeType: string;
  extension: string;
}

/** Extension allow-list lookup, shared by both the declare-only and the sniffed paths. */
function findSpec(originalName: string): { extension: string; spec: FormatSpec } {
  const extension = extname(originalName).toLowerCase();
  if (!extension) {
    throw new BadRequestException(`"${originalName}" has no file extension`);
  }
  const spec = FORMATS.find((f) => f.extensions.includes(extension));
  if (!spec) {
    throw new BadRequestException(
      `"${extension}" files are not accepted. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    );
  }
  return { extension, spec };
}

/** Extension + declared-size check only — no bytes needed yet. Used before issuing a presigned upload URL. */
export function validateDeclaredUpload(
  originalName: string,
  declaredSizeBytes: number,
  limits: UploadLimits,
): ValidatedFile {
  const { extension, spec } = findSpec(originalName);

  if (declaredSizeBytes <= 0) {
    throw new BadRequestException(`"${originalName}" is empty`);
  }

  const maxBytes = limits[spec.limitKey];
  if (declaredSizeBytes > maxBytes) {
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    throw new BadRequestException(
      `"${originalName}" is ${mb(declaredSizeBytes)} MB — the limit for ${extension} files is ${mb(maxBytes)} MB`,
    );
  }

  return { fileType: spec.fileType, mimeType: spec.mimeType, extension };
}

/**
 * Full validation from a `prefix` (some or all of the file's bytes) and its
 * true `totalLength` — extension allow-list, magic-byte sniff, and a
 * per-category size cap. The browser's `Content-Type` is deliberately
 * ignored — it is attacker-controlled and proves nothing about the bytes on
 * disk.
 */
export function validateFormat(
  originalName: string,
  prefix: Buffer,
  totalLength: number,
  limits: UploadLimits,
): ValidatedFile {
  const { extension, spec } = findSpec(originalName);

  if (totalLength === 0) {
    throw new BadRequestException(`"${originalName}" is empty`);
  }

  const maxBytes = limits[spec.limitKey];
  if (totalLength > maxBytes) {
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    throw new BadRequestException(
      `"${originalName}" is ${mb(totalLength)} MB — the limit for ${extension} files is ${mb(maxBytes)} MB`,
    );
  }

  if (!spec.sniff(prefix, totalLength)) {
    throw new BadRequestException(
      `"${originalName}" does not appear to be a valid ${extension.slice(1).toUpperCase()} file`,
    );
  }

  return { fileType: spec.fileType, mimeType: spec.mimeType, extension };
}

/** Server-side upload validation against a fully-buffered file (the small multipart-proxy path). */
export function validateUpload(
  originalName: string,
  buffer: Buffer,
  limits: UploadLimits,
): ValidatedFile {
  return validateFormat(originalName, buffer, buffer.length, limits);
}
