import { Global, Module } from '@nestjs/common';
import { PdfService } from './pdf.service';

/** PDF rendering, used by invoicing and statements. Global — no state to scope. */
@Global()
@Module({
  providers: [PdfService],
  exports: [PdfService],
})
export class DocumentsModule {}
