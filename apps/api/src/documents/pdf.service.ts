import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { AppConfig } from '../config/app.config';
import { Dentist, Invoice, MonthlyStatement } from '../database/entities';

/**
 * The Apex palette, kept in step with the web app's Tailwind theme. Every
 * value is one of the four brand colours or a tint of Oxford Navy — printed
 * documents carry the identity as much as the site does.
 */
/** Super Blue — the laboratory's name and the one live link on the page. */
const BRAND = '#0049cc';
/** Shocking Black — the guidelines' text black. */
const INK = '#111111';
/** Oxford Navy at 400: secondary text that still clears AA on white (8.3:1). */
const MUTED = '#2b4f80';
/** Oxford Navy at 50 — hairlines and table rules. */
const RULE = '#e8edf5';
/** Shiny Pearl — the warm fill the brand uses in place of a grey wash. */
const WASH = '#fff7e6';

/** The laboratory's legal name, as the brand guidelines set it. */
const LAB_NAME = 'Apex Digital Lab';
/** The positioning line the marketing site signs off with. */
const LAB_TAGLINE =
  'Focused-SKU Digital Lab Partner exclusively for independent US general dentists.';

const PAGE_MARGIN = 50;

export interface InvoicePdfData {
  invoice: Invoice;
  dentist: Dentist & { user?: { firstName: string; lastName: string; email: string } };
  /** Absolute URL the dentist can follow to pay online. */
  payUrl?: string;
}

export interface StatementPdfData {
  statement: MonthlyStatement;
  dentist: Dentist & { user?: { firstName: string; lastName: string; email: string } };
  invoices: Invoice[];
}

/**
 * Server-side PDF rendering with pdfkit. Documents are produced into a Buffer
 * so the caller decides whether to stream them or persist them to storage.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private readonly config: ConfigService) {}

  private get app(): AppConfig {
    return this.config.get<AppConfig>('app')!;
  }

  /** Logo shipped alongside the API build; absent in some deployments. */
  private get logoPath(): string | null {
    for (const base of [join(__dirname, '../../assets'), join(process.cwd(), 'assets')]) {
      const candidate = join(base, 'logo.png');
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  private render(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        build(doc);
        doc.end();
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private money(amount: string | number, currency: string): string {
    const value = typeof amount === 'string' ? Number(amount) : amount;
    return `${currency} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }

  /** Branded header band with the logo and lab name. */
  private header(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
    const logo = this.logoPath;
    if (logo) {
      try {
        doc.image(logo, PAGE_MARGIN, 42, { width: 34 });
      } catch (err) {
        this.logger.warn(`Could not embed logo in PDF: ${String(err)}`);
      }
    }

    const textX = logo ? PAGE_MARGIN + 46 : PAGE_MARGIN;
    // Name only. The laboratory has no short strapline of its own, and the
    // positioning line the brand does own is a footer-width sentence — it goes
    // there rather than being trimmed into something nobody wrote.
    doc.fillColor(BRAND).fontSize(17).font('Helvetica-Bold').text(LAB_NAME, textX, 54);

    doc.fillColor(INK).fontSize(22).font('Helvetica-Bold').text(title, PAGE_MARGIN, 44, {
      align: 'right',
    });
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(subtitle, PAGE_MARGIN, 72, {
      align: 'right',
    });

    doc.moveTo(PAGE_MARGIN, 100).lineTo(545, 100).strokeColor(RULE).lineWidth(1).stroke();
    doc.y = 120;
  }

  private footer(doc: PDFKit.PDFDocument, note: string): void {
    const y = 760;
    // Text this close to the page edge would trip pdfkit's automatic page
    // break and emit a stray blank page; suspending the bottom margin for the
    // duration of the footer keeps it anchored to the current page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(PAGE_MARGIN, y).lineTo(545, y).strokeColor(RULE).lineWidth(1).stroke();
    doc
      .fillColor(INK)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(LAB_TAGLINE, PAGE_MARGIN, y + 10, { width: 495, align: 'center' });
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font('Helvetica')
      .text(note, PAGE_MARGIN, y + 22, { width: 495, align: 'center' });

    doc.page.margins.bottom = bottomMargin;
  }

  private billTo(
    doc: PDFKit.PDFDocument,
    dentist: InvoicePdfData['dentist'],
    startY: number,
  ): void {
    doc.fillColor(MUTED).fontSize(9).font('Helvetica-Bold').text('BILL TO', PAGE_MARGIN, startY);
    const name = dentist.user
      ? `${dentist.user.firstName} ${dentist.user.lastName}`.trim()
      : 'Dentist';
    doc.fillColor(INK).fontSize(11).font('Helvetica-Bold').text(name, PAGE_MARGIN, startY + 14);

    const lines = [
      dentist.clinicName,
      dentist.billingAddress ?? dentist.clinicAddress,
      dentist.user?.email,
    ].filter((line): line is string => Boolean(line));

    doc.fillColor(MUTED).fontSize(10).font('Helvetica');
    let y = startY + 30;
    for (const line of lines) {
      doc.text(line, PAGE_MARGIN, y, { width: 240 });
      y = doc.y + 2;
    }
  }

  /** Simple column-based table renderer shared by both document types. */
  private table(
    doc: PDFKit.PDFDocument,
    columns: Array<{ label: string; width: number; align?: 'left' | 'right' }>,
    rows: string[][],
    startY: number,
  ): number {
    let y = startY;

    // Header row
    doc.rect(PAGE_MARGIN, y, 495, 22).fill(WASH);
    doc.fillColor(MUTED).fontSize(9).font('Helvetica-Bold');
    let x = PAGE_MARGIN + 8;
    columns.forEach((col) => {
      doc.text(col.label.toUpperCase(), x, y + 7, {
        width: col.width - 16,
        align: col.align ?? 'left',
      });
      x += col.width;
    });
    y += 22;

    // Body rows
    doc.font('Helvetica').fontSize(10);
    for (const row of rows) {
      // Start a new page before overflowing the footer area.
      if (y > 720) {
        doc.addPage();
        y = PAGE_MARGIN;
      }
      x = PAGE_MARGIN + 8;
      doc.fillColor(INK);
      row.forEach((cell, index) => {
        const col = columns[index];
        doc.text(cell, x, y + 6, { width: col.width - 16, align: col.align ?? 'left' });
        x += col.width;
      });
      y += 24;
      doc.moveTo(PAGE_MARGIN, y).lineTo(545, y).strokeColor(RULE).lineWidth(0.5).stroke();
    }
    return y;
  }

  private totals(
    doc: PDFKit.PDFDocument,
    lines: Array<[string, string, boolean?]>,
    startY: number,
  ): void {
    let y = startY + 12;
    for (const [label, value, emphasise] of lines) {
      doc
        .fillColor(emphasise ? INK : MUTED)
        .font(emphasise ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(emphasise ? 12 : 10)
        .text(label, 320, y, { width: 120, align: 'right' })
        .text(value, 445, y, { width: 100, align: 'right' });
      y += emphasise ? 22 : 18;
    }
  }

  async invoice(data: InvoicePdfData): Promise<Buffer> {
    const { invoice, dentist, payUrl } = data;
    const currency = invoice.currency;

    return this.render((doc) => {
      this.header(doc, 'INVOICE', invoice.number);

      this.billTo(doc, dentist, 120);

      // Invoice meta, right-aligned opposite the bill-to block.
      const meta: Array<[string, string]> = [
        ['Invoice number', invoice.number],
        ['Issue date', invoice.issueDate],
        ['Due date', invoice.dueDate ?? '—'],
        ['Status', invoice.status.toUpperCase()],
      ];
      let metaY = 120;
      for (const [label, value] of meta) {
        doc.fillColor(MUTED).fontSize(9).font('Helvetica').text(label, 320, metaY, {
          width: 110,
          align: 'right',
        });
        doc.fillColor(INK).fontSize(10).font('Helvetica-Bold').text(value, 435, metaY, {
          width: 110,
          align: 'right',
        });
        metaY += 18;
      }

      const rows = (invoice.lineItems ?? []).map((item) => [
        item.description,
        String(item.quantity),
        this.money(item.unitPrice, currency),
        this.money(item.total, currency),
      ]);

      const tableEnd = this.table(
        doc,
        [
          { label: 'Description', width: 245 },
          { label: 'Qty', width: 60, align: 'right' },
          { label: 'Unit price', width: 95, align: 'right' },
          { label: 'Amount', width: 95, align: 'right' },
        ],
        rows.length ? rows : [['No line items', '', '', '']],
        Math.max(doc.y, 230),
      );

      this.totals(
        doc,
        [
          ['Subtotal', this.money(invoice.subtotal, currency)],
          ['Tax', this.money(invoice.tax, currency)],
          ['Total due', this.money(invoice.total, currency), true],
        ],
        tableEnd,
      );

      if (payUrl && invoice.status !== 'paid') {
        doc
          .fillColor(MUTED)
          .fontSize(9)
          .font('Helvetica')
          .text('Pay this invoice online:', PAGE_MARGIN, tableEnd + 30);
        doc.fillColor(BRAND).fontSize(9).text(payUrl, PAGE_MARGIN, tableEnd + 44, {
          link: payUrl,
          underline: true,
        });
      }

      if (invoice.paidAt) {
        doc
          .fillColor('#059669')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('PAID', PAGE_MARGIN, tableEnd + 30);
      }

      this.footer(
        doc,
        `${this.app.webUrl} · Thank you for your business. Questions about this invoice? Reply to your usual laboratory contact.`,
      );
    });
  }

  async statement(data: StatementPdfData): Promise<Buffer> {
    const { statement, dentist, invoices } = data;
    const currency = invoices[0]?.currency ?? this.app.defaultCurrency;
    const period = new Date(statement.periodYear, statement.periodMonth - 1, 1);
    const periodLabel = period.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return this.render((doc) => {
      this.header(doc, 'STATEMENT', periodLabel);
      this.billTo(doc, dentist, 120);

      const rows = invoices.map((invoice) => [
        invoice.number,
        invoice.issueDate,
        invoice.status.toUpperCase(),
        this.money(invoice.total, invoice.currency),
      ]);

      const tableEnd = this.table(
        doc,
        [
          { label: 'Invoice', width: 150 },
          { label: 'Date', width: 120 },
          { label: 'Status', width: 110 },
          { label: 'Amount', width: 115, align: 'right' },
        ],
        rows.length ? rows : [['No invoices in this period', '', '', '']],
        Math.max(doc.y, 230),
      );

      this.totals(
        doc,
        [
          ['Opening balance', this.money(statement.openingBalance, currency)],
          ['Total invoiced', this.money(statement.totalInvoiced, currency)],
          ['Total paid', this.money(statement.totalPaid, currency)],
          ['Closing balance', this.money(statement.closingBalance, currency), true],
        ],
        tableEnd,
      );

      this.footer(
        doc,
        `${this.app.webUrl} · Statement for ${periodLabel}. Amounts shown in ${currency}.`,
      );
    });
  }
}
