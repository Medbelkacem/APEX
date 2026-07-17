import { registerAs } from '@nestjs/config';

const mb = (v: string | undefined, def: number) => Number(v ?? def) * 1024 * 1024;

export const storageConfig = registerAs('storage', () => ({
  driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  localRoot: process.env.STORAGE_LOCAL_ROOT ?? '../../storage',
  // Size limits expressed in bytes for direct comparison against uploads.
  maxUploadBytes: mb(process.env.MAX_UPLOAD_MB, 100),
  maxImageBytes: mb(process.env.MAX_IMAGE_MB, 10),
  maxDocumentBytes: mb(process.env.MAX_DOCUMENT_MB, 25),
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? '',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
}));

export type StorageConfig = ReturnType<typeof storageConfig>;
