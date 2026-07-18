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
  /** Verify the file's magic bytes actually match the claimed format. */
  sniff: (buf: Buffer) => boolean;
}

/**
 * A binary STL is an 80-byte header, a uint32 triangle count, then exactly
 * 50 bytes per triangle — checking that arithmetic is a far stronger signal
 * than any header string. ASCII STL simply starts with "solid".
 */
function isStl(buf: Buffer): boolean {
  if (buf.length >= 84) {
    const triangles = buf.readUInt32LE(80);
    if (buf.length === 84 + triangles * 50) return true;
  }
  const head = buf.subarray(0, 6).toString('ascii').trimStart().toLowerCase();
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
    sniff: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
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

/**
 * Server-side upload validation: extension allow-list, magic-byte sniff, and a
 * per-category size cap. The browser's `Content-Type` is deliberately ignored —
 * it is attacker-controlled and proves nothing about the bytes on disk.
 */
export function validateUpload(
  originalName: string,
  buffer: Buffer,
  limits: UploadLimits,
): ValidatedFile {
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

  if (buffer.length === 0) {
    throw new BadRequestException(`"${originalName}" is empty`);
  }

  const maxBytes = limits[spec.limitKey];
  if (buffer.length > maxBytes) {
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    throw new BadRequestException(
      `"${originalName}" is ${mb(buffer.length)} MB — the limit for ${extension} files is ${mb(maxBytes)} MB`,
    );
  }

  if (!spec.sniff(buffer)) {
    throw new BadRequestException(
      `"${originalName}" does not appear to be a valid ${extension.slice(1).toUpperCase()} file`,
    );
  }

  return { fileType: spec.fileType, mimeType: spec.mimeType, extension };
}
