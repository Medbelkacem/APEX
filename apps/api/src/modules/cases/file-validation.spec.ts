import { BadRequestException } from '@nestjs/common';
import { CaseFileType } from '@dental/shared-types';
import { UploadLimits, validateUpload } from './file-validation';

const LIMITS: UploadLimits = {
  maxUploadBytes: 100 * 1024 * 1024,
  maxImageBytes: 10 * 1024 * 1024,
  maxDocumentBytes: 25 * 1024 * 1024,
};

/** Binary STL: 80-byte header, uint32 triangle count, 50 bytes per triangle. */
function binaryStl(triangles = 1): Buffer {
  const header = Buffer.alloc(80);
  const count = Buffer.alloc(4);
  count.writeUInt32LE(triangles, 0);
  return Buffer.concat([header, count, Buffer.alloc(triangles * 50)]);
}

const asciiStl = () => Buffer.from('solid model\nfacet normal 0 0 1\nendsolid model\n');
const png = () =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const pdf = () => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64)]);

describe('validateUpload', () => {
  it('accepts a binary STL and classifies it', () => {
    const result = validateUpload('scan.stl', binaryStl(3), LIMITS);
    expect(result).toEqual({
      fileType: CaseFileType.STL,
      mimeType: 'model/stl',
      extension: '.stl',
    });
  });

  it('accepts an ASCII STL', () => {
    expect(validateUpload('scan.STL', asciiStl(), LIMITS).fileType).toBe(CaseFileType.STL);
  });

  it('classifies images and documents', () => {
    expect(validateUpload('photo.png', png(), LIMITS).fileType).toBe(CaseFileType.IMAGE);
    expect(validateUpload('photo.jpeg', jpeg(), LIMITS).fileType).toBe(CaseFileType.IMAGE);
    expect(validateUpload('rx.pdf', pdf(), LIMITS).fileType).toBe(CaseFileType.DOCUMENT);
  });

  it('rejects an extension that is not on the allow-list', () => {
    expect(() => validateUpload('payload.exe', binaryStl(), LIMITS)).toThrow(BadRequestException);
    expect(() => validateUpload('payload.exe', binaryStl(), LIMITS)).toThrow(/not accepted/);
  });

  it('rejects a file with no extension at all', () => {
    expect(() => validateUpload('README', pdf(), LIMITS)).toThrow(/no file extension/);
  });

  it('rejects an empty file', () => {
    expect(() => validateUpload('scan.stl', Buffer.alloc(0), LIMITS)).toThrow(/is empty/);
  });

  // The security-critical case: a caller renaming an executable to .stl must not
  // slip past on extension alone.
  it('rejects content whose magic bytes contradict the extension', () => {
    const disguised = Buffer.from('MZ\x90\x00 this is a windows executable');
    expect(() => validateUpload('scan.stl', disguised, LIMITS)).toThrow(
      /does not appear to be a valid STL/,
    );
    expect(() => validateUpload('photo.png', disguised, LIMITS)).toThrow(/valid PNG/);
    expect(() => validateUpload('doc.pdf', disguised, LIMITS)).toThrow(/valid PDF/);
  });

  it('rejects a binary STL whose triangle count does not match its length', () => {
    const truncated = binaryStl(10).subarray(0, 200);
    expect(() => validateUpload('scan.stl', truncated, LIMITS)).toThrow(/valid STL/);
  });

  it('enforces the per-category size limit', () => {
    const tiny: UploadLimits = { ...LIMITS, maxImageBytes: 32 };
    expect(() => validateUpload('photo.png', png(), tiny)).toThrow(/the limit for .png/);
  });

  it('applies the STL limit to STLs and the image limit to images', () => {
    // An 8 KB image passes under the STL limit but fails its own smaller cap.
    const limits: UploadLimits = { ...LIMITS, maxImageBytes: 16 };
    expect(() => validateUpload('big.png', png(), limits)).toThrow(/limit/);
    expect(validateUpload('big.stl', binaryStl(1), limits).fileType).toBe(CaseFileType.STL);
  });

  it('is case-insensitive about extensions', () => {
    expect(validateUpload('SCAN.STL', binaryStl(), LIMITS).extension).toBe('.stl');
    expect(validateUpload('Photo.JPG', jpeg(), LIMITS).mimeType).toBe('image/jpeg');
  });
});
