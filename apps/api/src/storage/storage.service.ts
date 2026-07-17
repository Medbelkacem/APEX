import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { v4 as uuid } from 'uuid';
import { STORAGE_DRIVER, StorageDriver } from './storage-driver.interface';

/**
 * High-level storage API. Owns the DRS path scheme and generates collision-free
 * UUID filenames; callers never build storage paths themselves.
 *
 *   cases/{caseId}/{fileId}.{ext}
 *   invoices/{invoiceId}.pdf
 *   statements/{dentistId}/{YYYY-MM}.pdf
 */
@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  /** Build the relative path for a new case file and return it with a fresh id. */
  buildCaseFilePath(caseId: string, ext: string): { fileId: string; path: string } {
    const fileId = uuid();
    const clean = ext.replace(/^\./, '').toLowerCase();
    return { fileId, path: `cases/${caseId}/${fileId}.${clean}` };
  }

  invoicePdfPath(invoiceId: string): string {
    return `invoices/${invoiceId}.pdf`;
  }

  statementPdfPath(dentistId: string, year: number, month: number): string {
    const mm = String(month).padStart(2, '0');
    return `statements/${dentistId}/${year}-${mm}.pdf`;
  }

  save(relativePath: string, data: Buffer): Promise<void> {
    return this.driver.save(relativePath, data);
  }

  read(relativePath: string): Promise<Buffer> {
    return this.driver.read(relativePath);
  }

  stream(relativePath: string): Promise<Readable> {
    return this.driver.createReadStream(relativePath);
  }

  delete(relativePath: string): Promise<void> {
    return this.driver.delete(relativePath);
  }

  exists(relativePath: string): Promise<boolean> {
    return this.driver.exists(relativePath);
  }
}
