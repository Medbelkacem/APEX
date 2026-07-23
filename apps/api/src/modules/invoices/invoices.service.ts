import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, FilterQuery, Model } from 'mongoose';
import {
  AuthenticatedUser,
  InvoiceStatus,
  NotificationType,
  UserRole,
} from '@dental/shared-types';
import {
  Counter,
  DentalCase,
  Dentist,
  Invoice,
  InvoiceLineItem,
} from '../../database/entities';
import { runInTransaction } from '../../database/base.schema';
import { AppConfig } from '../../config/app.config';
import { allocateReference } from '../../common/utils/reference';
import { regexContains } from '../../common/utils/mongo';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import { emailTemplates } from '../../mail/templates';
import { StorageService } from '../../storage/storage.service';
import { PdfService } from '../../documents/pdf.service';
import { CatalogService } from '../catalog/catalog.service';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { GenerateBatchDto, GenerateInvoiceDto, ListInvoicesDto } from './invoices.dto';

/** Populate spec every invoice detail view needs. */
const DETAIL_POPULATE = [
  { path: 'dentist', populate: { path: 'user' } },
  { path: 'lineItems' },
  { path: 'case' },
];

/** Statuses that still owe money. */
const OUTSTANDING: InvoiceStatus[] = [InvoiceStatus.ISSUED];

/** A status value no invoice has — yields an empty result set. */
const MATCH_NONE = '__no_such_status__';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoices: Model<Invoice>,
    @InjectModel(DentalCase.name) private readonly cases: Model<DentalCase>,
    @InjectModel(Dentist.name) private readonly dentists: Model<Dentist>,
    @InjectModel(InvoiceLineItem.name) private readonly lineItems: Model<InvoiceLineItem>,
    @InjectModel(Counter.name) private readonly counters: Model<Counter>,
    @InjectConnection() private readonly connection: Connection,
    private readonly catalog: CatalogService,
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
    const dentist = await this.dentists.findOne({ userId }).exec();
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
    const filter: FilterQuery<Invoice> = {};

    await this.applyScope(filter, user, query);

    if (query.dateFrom || query.dateTo) {
      const issueDate: Record<string, string> = {};
      if (query.dateFrom) issueDate.$gte = query.dateFrom;
      if (query.dateTo) issueDate.$lte = query.dateTo;
      filter.issueDate = issueDate;
    }

    if (query.search) {
      const rx = regexContains(query.search);
      // `case.reference` lives on another collection, so resolve the matching
      // case ids first, then OR them with the invoice number.
      const caseIds = await this.cases.find({ reference: rx }).distinct('_id').exec();
      filter.$or = [{ number: rx }, { caseId: { $in: caseIds } }];
    }

    const [data, total] = await Promise.all([
      this.invoices
        .find(filter)
        .populate({ path: 'dentist', populate: { path: 'user' } })
        .populate('case')
        .sort({ issueDate: -1, number: -1 })
        .skip(skip)
        .limit(take)
        .exec(),
      this.invoices.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }

  /** Apply access scope + the status filter, which interact for dentists. */
  private async applyScope(
    filter: FilterQuery<Invoice>,
    user: AuthenticatedUser,
    query: ListInvoicesDto,
  ): Promise<void> {
    if (this.isAdmin(user)) {
      if (query.dentistId) filter.dentistId = query.dentistId;
      if (query.status) filter.status = query.status;
      return;
    }

    const dentist = await this.dentistForUser(user.id);
    filter.dentistId = dentist.id;
    // A dentist must never see a draft the lab has not issued yet.
    if (query.status) {
      filter.status = query.status === InvoiceStatus.DRAFT ? MATCH_NONE : query.status;
    } else {
      filter.status = { $ne: InvoiceStatus.DRAFT };
    }
  }

  async findByIdOrFail(id: string): Promise<Invoice> {
    const invoice = await this.invoices.findById(id).populate(DETAIL_POPULATE).exec();
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
    const filter: FilterQuery<Invoice> = { status: { $in: OUTSTANDING } };
    if (!this.isAdmin(user)) {
      const dentist = await this.dentistForUser(user.id);
      filter.dentistId = dentist.id;
    }

    const rows = await this.invoices.find(filter).exec();
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
    const entity = await this.cases
      .findById(dto.caseId)
      .populate('dentist')
      .populate('caseType')
      .exec();
    if (!entity) throw new NotFoundException('Case not found');

    const existing = await this.invoices.findOne({ caseId: entity.id }).exec();
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
    const dentist = await this.dentists.findById(dto.dentistId).exec();
    if (!dentist) throw new NotFoundException('Dentist not found');

    const statuses = await this.catalog.listStatuses(true);
    const terminalIds = statuses.filter((s) => s.isTerminal).map((s) => s.id);
    // Cases already covered by a live (non-deleted) invoice are excluded.
    const invoicedCaseIds = await this.invoices
      .find({ caseId: { $ne: null } })
      .distinct('caseId')
      .exec();

    const caseFilter: FilterQuery<DentalCase> = {
      dentistId: dto.dentistId,
      currentStatusId: { $in: terminalIds },
      _id: { $nin: invoicedCaseIds },
    };
    if (dto.dateFrom || dto.dateTo) {
      const completedAt: Record<string, Date> = {};
      if (dto.dateFrom) completedAt.$gte = new Date(`${dto.dateFrom}T00:00:00.000Z`);
      if (dto.dateTo) {
        const end = new Date(`${dto.dateTo}T00:00:00.000Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        completedAt.$lt = end;
      }
      caseFilter.completedAt = completedAt;
    }

    const pending = await this.cases
      .find(caseFilter)
      .populate('caseType')
      .sort({ completedAt: 1 })
      .exec();
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

    // One invoice carries one currency; its subtotal is a plain sum of the line
    // totals. If the pending cases price in different currencies (rules can set
    // their own), summing them would conflate the amounts under whichever
    // currency happened to come first — so refuse rather than misstate a total.
    const currencies = new Set(lines.map((line) => line.currency));
    if (currencies.size > 1) {
      throw new BadRequestException(
        'These cases price in more than one currency — invoice them separately, one currency per batch',
      );
    }

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

    const created = await runInTransaction(this.connection, async (session) => {
      const number = await allocateReference(this.counters, { prefix: 'INV' }, session);

      const [invoice] = await this.invoices.create(
        [
          {
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
          },
        ],
        { session },
      );

      await this.lineItems.create(
        input.lines.map((line) => ({
          invoiceId: invoice.id,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: this.fromCents(this.toCents(line.unitPrice) * line.quantity),
        })),
        // Mongoose requires ordered inserts when creating multiple docs in a session.
        { session, ordered: true },
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

    await this.invoices.updateOne({ _id: id }, { status: InvoiceStatus.ISSUED }).exec();
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
    // A refund is the end of the line. Without this, Stripe redelivering the
    // original `payment_intent.succeeded` — which it does for days — would turn
    // a refunded invoice back into a paid one.
    if (invoice.status === InvoiceStatus.REFUNDED) {
      throw new BadRequestException('A refunded invoice cannot be marked paid');
    }
    // Only an issued invoice can be settled. A draft has never been sent to the
    // dentist, so marking it paid would skip the issue step and strand an
    // invoice that can no longer be issued.
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Only an issued invoice can be marked paid');
    }

    await this.invoices
      .updateOne(
        { _id: id },
        {
          status: InvoiceStatus.PAID,
          paidAt: new Date(),
          ...(options.stripePaymentIntentId && {
            stripePaymentIntentId: options.stripePaymentIntentId,
          }),
        },
      )
      .exec();

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
    await this.invoices.updateOne({ _id: id }, { status: InvoiceStatus.CANCELLED }).exec();
    return this.findByIdOrFail(id);
  }

  /**
   * Record a refund that has already happened at the payment provider — the
   * `charge.refunded` webhook path. Stripe redelivers that event, so arriving
   * at an already-refunded invoice is success, not an error.
   */
  async markRefunded(id: string): Promise<Invoice> {
    const invoice = await this.findByIdOrFail(id);
    if (invoice.status === InvoiceStatus.REFUNDED) return invoice;
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Only a paid invoice can be refunded');
    }
    await this.invoices.updateOne({ _id: id }, { status: InvoiceStatus.REFUNDED }).exec();
    return this.findByIdOrFail(id);
  }

  /**
   * Take exclusive ownership of the PAID → REFUNDED transition.
   *
   * The condition lives in the update filter rather than in a preceding read
   * because a read-then-write pair lets two concurrent refunds both observe
   * PAID and both go on to charge Stripe. Here the database decides: exactly one
   * caller sees `modifiedCount === 1`, and only that caller may issue the refund.
   */
  async claimRefund(id: string): Promise<boolean> {
    const result = await this.invoices
      .updateOne({ _id: id, status: InvoiceStatus.PAID }, { status: InvoiceStatus.REFUNDED })
      .exec();
    return result.modifiedCount === 1;
  }

  /** Hand the claim back when the refund could not be completed after all. */
  async releaseRefundClaim(id: string): Promise<void> {
    await this.invoices
      .updateOne({ _id: id, status: InvoiceStatus.REFUNDED }, { status: InvoiceStatus.PAID })
      .exec();
  }

  async findByPaymentIntent(paymentIntentId: string): Promise<Invoice | null> {
    return this.invoices
      .findOne({ stripePaymentIntentId: paymentIntentId })
      .populate(DETAIL_POPULATE)
      .exec();
  }

  async attachPaymentIntent(id: string, paymentIntentId: string): Promise<void> {
    await this.invoices.updateOne({ _id: id }, { stripePaymentIntentId: paymentIntentId }).exec();
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  /** Render and cache the invoice PDF, returning the bytes. */
  async renderAndStorePdf(invoice: Invoice): Promise<Buffer> {
    const buffer = await this.pdf.invoice({
      invoice,
      dentist: invoice.dentist!,
      payUrl: `${this.app.webUrl}/invoices/${invoice.id}`,
    });
    const path = this.storage.invoicePdfPath(invoice.id);
    await this.storage.save(path, buffer);
    if (invoice.pdfPath !== path) {
      await this.invoices.updateOne({ _id: invoice.id }, { pdfPath: path }).exec();
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
    return this.invoices
      .find({ dentistId, issueDate: { $gte: from, $lte: to } })
      .populate('lineItems')
      .sort({ issueDate: 1 })
      .exec();
  }
}
