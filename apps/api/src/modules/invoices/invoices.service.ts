import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import {
  AuthenticatedUser,
  InvoiceStatus,
  NotificationType,
  UserRole,
} from '@dental/shared-types';
import {
  DentalCase,
  Dentist,
  Invoice,
  InvoiceLineItem,
} from '../../database/entities';
import { AppConfig } from '../../config/app.config';
import { allocateReference } from '../../common/utils/reference';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import { emailTemplates } from '../../mail/templates';
import { StorageService } from '../../storage/storage.service';
import { PdfService } from '../../documents/pdf.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { GenerateBatchDto, GenerateInvoiceDto, ListInvoicesDto } from './invoices.dto';

const DETAIL_RELATIONS = {
  dentist: { user: true },
  lineItems: true,
  case: true,
} as const;

/** Statuses that still owe money. */
const OUTSTANDING: InvoiceStatus[] = [InvoiceStatus.ISSUED];

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(DentalCase) private readonly cases: Repository<DentalCase>,
    @InjectRepository(Dentist) private readonly dentists: Repository<Dentist>,
    private readonly dataSource: DataSource,
    private readonly pricing: PricingService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  private get app(): AppConfig {
    return this.config.get<AppConfig>('app')!;
  }

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }

  private async dentistForUser(userId: string): Promise<Dentist> {
    const dentist = await this.dentists.findOne({ where: { userId } });
    if (!dentist) throw new ForbiddenException('No dentist profile is linked to this account');
    return dentist;
  }

  // ── Money helpers ─────────────────────────────────────────────────────────
  // Amounts are decimal strings end-to-end; arithmetic goes through cents to
  // avoid binary-float drift on values like 0.1 + 0.2.

  private toCents(amount: string | number): number {
    return Math.round(Number(amount) * 100);
  }

  private fromCents(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async list(query: ListInvoicesDto, user: AuthenticatedUser): Promise<Paginated<Invoice>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const qb = this.invoices
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.dentist', 'dentist')
      .leftJoinAndSelect('dentist.user', 'dentistUser')
      .leftJoinAndSelect('invoice.case', 'case');

    await this.applyScope(qb, user, query.dentistId);

    if (query.status) qb.andWhere('invoice.status = :status', { status: query.status });
    if (query.dateFrom) qb.andWhere('invoice.issueDate >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('invoice.issueDate <= :dateTo', { dateTo: query.dateTo });
    if (query.search) {
      qb.andWhere('(invoice.number ILIKE :q OR case.reference ILIKE :q)', {
        q: `%${query.search}%`,
      });
    }

    qb.orderBy('invoice.issueDate', 'DESC').addOrderBy('invoice.number', 'DESC').skip(skip).take(take);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  private async applyScope(
    qb: SelectQueryBuilder<Invoice>,
    user: AuthenticatedUser,
    requestedDentistId?: string,
  ): Promise<void> {
    if (this.isAdmin(user)) {
      if (requestedDentistId) {
        qb.andWhere('invoice.dentistId = :dentistId', { dentistId: requestedDentistId });
      }
      return;
    }
    const dentist = await this.dentistForUser(user.id);
    qb.andWhere('invoice.dentistId = :ownDentistId', { ownDentistId: dentist.id });
    // A dentist must never see a draft the lab has not issued yet.
    qb.andWhere('invoice.status != :draft', { draft: InvoiceStatus.DRAFT });
  }

  async findByIdOrFail(id: string): Promise<Invoice> {
    const invoice = await this.invoices.findOne({ where: { id }, relations: DETAIL_RELATIONS });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async findScoped(id: string, user: AuthenticatedUser): Promise<Invoice> {
    const invoice = await this.findByIdOrFail(id);
    if (this.isAdmin(user)) return invoice;

    const dentist = await this.dentistForUser(user.id);
    if (invoice.dentistId !== dentist.id || invoice.status === InvoiceStatus.DRAFT) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /** Unpaid total for the dentist dashboard's balance card. */
  async outstanding(user: AuthenticatedUser): Promise<{
    total: string;
    currency: string;
    count: number;
  }> {
    const qb = this.invoices
      .createQueryBuilder('invoice')
      .where('invoice.status IN (:...statuses)', { statuses: OUTSTANDING });

    if (!this.isAdmin(user)) {
      const dentist = await this.dentistForUser(user.id);
      qb.andWhere('invoice.dentistId = :dentistId', { dentistId: dentist.id });
    }

    const rows = await qb.getMany();
    const cents = rows.reduce((sum, invoice) => sum + this.toCents(invoice.total), 0);
    return {
      total: this.fromCents(cents),
      currency: rows[0]?.currency ?? this.app.defaultCurrency,
      count: rows.length,
    };
  }

  // ── Generation ────────────────────────────────────────────────────────────

  /** Build a draft invoice for one case, priced from the pricing rules. */
  async generateForCase(dto: GenerateInvoiceDto): Promise<Invoice> {
    const entity = await this.cases.findOne({
      where: { id: dto.caseId },
      relations: { dentist: true, caseType: true },
    });
    if (!entity) throw new NotFoundException('Case not found');

    const existing = await this.invoices.findOne({
      where: { caseId: entity.id },
    });
    if (existing) {
      throw new BadRequestException(
        `Case ${entity.reference} is already covered by invoice ${existing.number}`,
      );
    }

    const quote = await this.pricing.quote(
      entity.caseTypeId,
      entity.material,
      entity.dentist?.tier ?? null,
    );
    const unitPrice = dto.unitPrice ?? quote.price;

    return this.createInvoice({
      dentistId: entity.dentistId,
      caseId: entity.id,
      currency: quote.currency,
      dueInDays: dto.dueInDays,
      lines: [
        {
          description: `${entity.caseType?.name ?? 'Case'} — ${entity.reference} (${entity.patientReference})`,
          quantity: 1,
          unitPrice,
        },
      ],
    });
  }

  /**
   * Invoice every completed, not-yet-invoiced case for a dentist in a period,
   * as a single batch invoice with one line per case.
   */
  async generateBatch(dto: GenerateBatchDto): Promise<{ created: number; invoice: Invoice | null }> {
    const dentist = await this.dentists.findOne({ where: { id: dto.dentistId } });
    if (!dentist) throw new NotFoundException('Dentist not found');

    const qb = this.cases
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.caseType', 'caseType')
      .leftJoin('c.currentStatus', 'status')
      .leftJoin('invoices', 'invoice', 'invoice.case_id = c.id AND invoice.deleted_at IS NULL')
      .where('c.dentistId = :dentistId', { dentistId: dto.dentistId })
      .andWhere('status.isTerminal = true')
      .andWhere('invoice.id IS NULL');

    if (dto.dateFrom) qb.andWhere('c.completedAt >= :dateFrom', { dateFrom: dto.dateFrom });
    if (dto.dateTo) {
      qb.andWhere("c.completedAt < (:dateTo::date + INTERVAL '1 day')", { dateTo: dto.dateTo });
    }

    const pending = await qb.orderBy('c.completedAt', 'ASC').getMany();
    if (pending.length === 0) return { created: 0, invoice: null };

    const lines = await Promise.all(
      pending.map(async (entity) => {
        const quote = await this.pricing.quote(
          entity.caseTypeId,
          entity.material,
          dentist.tier ?? null,
        );
        return {
          description: `${entity.caseType?.name ?? 'Case'} — ${entity.reference} (${entity.patientReference})`,
          quantity: 1,
          unitPrice: quote.price,
          currency: quote.currency,
        };
      }),
    );

    const invoice = await this.createInvoice({
      dentistId: dto.dentistId,
      caseId: null,
      currency: lines[0]?.currency ?? this.app.defaultCurrency,
      dueInDays: dto.dueInDays,
      lines,
    });
    return { created: pending.length, invoice };
  }

  /** Shared creation path: allocates the number, computes totals, persists. */
  private async createInvoice(input: {
    dentistId: string;
    caseId: string | null;
    currency: string;
    dueInDays?: number;
    lines: Array<{ description: string; quantity: number; unitPrice: string }>;
  }): Promise<Invoice> {
    const taxRate = await this.settings.taxRate();

    const subtotalCents = input.lines.reduce(
      (sum, line) => sum + this.toCents(line.unitPrice) * line.quantity,
      0,
    );
    const taxCents = Math.round(subtotalCents * taxRate);
    const totalCents = subtotalCents + taxCents;

    const dueDays = input.dueInDays ?? (await this.settings.paymentTermsDays());
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    const created = await this.dataSource.transaction(async (manager) => {
      const number = await allocateReference(manager, {
        table: 'invoices',
        column: 'number',
        prefix: 'INV',
      });

      const invoiceRepo = manager.getRepository(Invoice);
      const invoice = await invoiceRepo.save(
        invoiceRepo.create({
          number,
          dentistId: input.dentistId,
          caseId: input.caseId,
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: dueDate.toISOString().slice(0, 10),
          subtotal: this.fromCents(subtotalCents),
          tax: this.fromCents(taxCents),
          total: this.fromCents(totalCents),
          currency: input.currency,
          status: InvoiceStatus.DRAFT,
        }),
      );

      const itemRepo = manager.getRepository(InvoiceLineItem);
      await itemRepo.save(
        input.lines.map((line) =>
          itemRepo.create({
            invoiceId: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: this.fromCents(this.toCents(line.unitPrice) * line.quantity),
          }),
        ),
      );

      return invoice;
    });

    return this.findByIdOrFail(created.id);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Draft → issued: renders the PDF, emails the dentist. */
  async issue(id: string): Promise<Invoice> {
    const invoice = await this.findByIdOrFail(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Invoice ${invoice.number} has already been issued`);
    }

    await this.invoices.update(id, { status: InvoiceStatus.ISSUED });
    const issued = await this.findByIdOrFail(id);
    await this.renderAndStorePdf(issued);

    const tpl = emailTemplates.invoiceIssued({
      number: issued.number,
      total: issued.total,
      currency: issued.currency,
      dueDate: issued.dueDate,
      invoiceUrl: `${this.app.webUrl}/invoices/${issued.id}`,
    });
    if (issued.dentist?.userId) {
      await this.notifications.notify({
        userId: issued.dentist.userId,
        type: NotificationType.INVOICE_ISSUED,
        subject: tpl.subject,
        body: `Invoice ${issued.number} for ${issued.currency} ${issued.total} has been issued.`,
        email: { html: tpl.html, text: tpl.text },
        relatedInvoiceId: issued.id,
      });
    }
    return issued;
  }

  /** Record settlement — used by both manual admin marking and Stripe webhooks. */
  async markPaid(
    id: string,
    options: { stripePaymentIntentId?: string; notify?: boolean } = {},
  ): Promise<Invoice> {
    const invoice = await this.findByIdOrFail(id);
    if (invoice.status === InvoiceStatus.PAID) return invoice;
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('A cancelled invoice cannot be marked paid');
    }

    await this.invoices.update(id, {
      status: InvoiceStatus.PAID,
      paidAt: new Date(),
      ...(options.stripePaymentIntentId && {
        stripePaymentIntentId: options.stripePaymentIntentId,
      }),
    });

    const paid = await this.findByIdOrFail(id);
    // The cached PDF shows a PAID stamp, so it must be re-rendered.
    await this.renderAndStorePdf(paid);

    if (options.notify !== false && paid.dentist?.userId) {
      const tpl = emailTemplates.paymentReceived({
        number: paid.number,
        total: paid.total,
        currency: paid.currency,
        invoiceUrl: `${this.app.webUrl}/invoices/${paid.id}`,
      });
      await this.notifications.notify({
        userId: paid.dentist.userId,
        type: NotificationType.PAYMENT_RECEIVED,
        subject: tpl.subject,
        body: `Payment of ${paid.currency} ${paid.total} received for invoice ${paid.number}.`,
        email: { html: tpl.html, text: tpl.text },
        relatedInvoiceId: paid.id,
      });
    }
    return paid;
  }

  async cancel(id: string): Promise<Invoice> {
    const invoice = await this.findByIdOrFail(id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('A paid invoice cannot be cancelled — refund it instead');
    }
    await this.invoices.update(id, { status: InvoiceStatus.CANCELLED });
    return this.findByIdOrFail(id);
  }

  async markRefunded(id: string): Promise<Invoice> {
    const invoice = await this.findByIdOrFail(id);
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Only a paid invoice can be refunded');
    }
    await this.invoices.update(id, { status: InvoiceStatus.REFUNDED });
    return this.findByIdOrFail(id);
  }

  async findByPaymentIntent(paymentIntentId: string): Promise<Invoice | null> {
    return this.invoices.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
      relations: DETAIL_RELATIONS,
    });
  }

  async attachPaymentIntent(id: string, paymentIntentId: string): Promise<void> {
    await this.invoices.update(id, { stripePaymentIntentId: paymentIntentId });
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  /** Render and cache the invoice PDF, returning the bytes. */
  async renderAndStorePdf(invoice: Invoice): Promise<Buffer> {
    const buffer = await this.pdf.invoice({
      invoice,
      dentist: invoice.dentist,
      payUrl: `${this.app.webUrl}/invoices/${invoice.id}`,
    });
    const path = this.storage.invoicePdfPath(invoice.id);
    await this.storage.save(path, buffer);
    if (invoice.pdfPath !== path) {
      await this.invoices.update(invoice.id, { pdfPath: path });
    }
    return buffer;
  }

  /**
   * Serve the invoice PDF, rendering on demand if it was never cached (or the
   * blob has gone missing) so a download never 404s on a valid invoice.
   */
  async pdfFor(id: string, user: AuthenticatedUser): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.findScoped(id, user);
    const path = invoice.pdfPath ?? this.storage.invoicePdfPath(invoice.id);

    const buffer = (await this.storage.exists(path))
      ? await this.storage.read(path)
      : await this.renderAndStorePdf(invoice);

    return { buffer, filename: `${invoice.number}.pdf` };
  }

  /** Invoices belonging to a dentist within a period — used by statements. */
  async forPeriod(dentistId: string, from: string, to: string): Promise<Invoice[]> {
    return this.invoices.find({
      where: { dentistId, deletedAt: IsNull() },
      relations: { lineItems: true },
      order: { issueDate: 'ASC' },
    }).then((rows) => rows.filter((i) => i.issueDate >= from && i.issueDate <= to));
  }
}
