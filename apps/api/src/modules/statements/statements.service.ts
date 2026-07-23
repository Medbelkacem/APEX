import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';
import {
  AuthenticatedUser,
  InvoiceStatus,
  NotificationType,
  UserRole,
  UserStatus,
} from '@dental/shared-types';
import { Dentist, Invoice, MonthlyStatement } from '../../database/entities';
import { AppConfig } from '../../config/app.config';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import { emailTemplates } from '../../mail/templates';
import { StorageService } from '../../storage/storage.service';
import { PdfService } from '../../documents/pdf.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Inclusive first/last day of a calendar month, as ISO dates. */
function monthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    @InjectModel(MonthlyStatement.name) private readonly statements: Model<MonthlyStatement>,
    @InjectModel(Invoice.name) private readonly invoices: Model<Invoice>,
    @InjectModel(Dentist.name) private readonly dentists: Model<Dentist>,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
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

  private toCents(amount: string | number): number {
    return Math.round(Number(amount) * 100);
  }

  private fromCents(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async list(
    query: { dentistId?: string; year?: number; page?: number; limit?: number },
    user: AuthenticatedUser,
  ): Promise<Paginated<MonthlyStatement>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const filter: FilterQuery<MonthlyStatement> = {};

    if (this.isAdmin(user)) {
      if (query.dentistId) filter.dentistId = query.dentistId;
    } else {
      const dentist = await this.dentistForUser(user.id);
      filter.dentistId = dentist.id;
    }
    if (query.year) filter.periodYear = query.year;

    const [data, total] = await Promise.all([
      this.statements
        .find(filter)
        .populate({ path: 'dentist', populate: { path: 'user' } })
        .sort({ periodYear: -1, periodMonth: -1 })
        .skip(skip)
        .limit(take)
        .exec(),
      this.statements.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }

  async findByIdOrFail(id: string): Promise<MonthlyStatement> {
    const statement = await this.statements
      .findById(id)
      .populate({ path: 'dentist', populate: { path: 'user' } })
      .exec();
    if (!statement) throw new NotFoundException('Statement not found');
    return statement;
  }

  async findScoped(id: string, user: AuthenticatedUser): Promise<MonthlyStatement> {
    const statement = await this.findByIdOrFail(id);
    if (this.isAdmin(user)) return statement;
    const dentist = await this.dentistForUser(user.id);
    if (statement.dentistId !== dentist.id) throw new NotFoundException('Statement not found');
    return statement;
  }

  // ── Generation ────────────────────────────────────────────────────────────

  /**
   * Build (or rebuild) a dentist's statement for one month. Re-running is safe:
   * the row is keyed on dentist+period and updated in place, so a correction
   * after a late invoice simply refreshes the figures and the PDF.
   */
  async generate(dentistId: string, year: number, month: number): Promise<MonthlyStatement> {
    const dentist = await this.dentists.findById(dentistId).populate('user').exec();
    if (!dentist) throw new NotFoundException('Dentist not found');

    const { from, to } = monthRange(year, month);
    const periodInvoices = await this.periodInvoices(dentistId, from, to);

    // Opening balance = everything still owed from before this period.
    const priorInvoices = await this.invoices
      .find({ dentistId, issueDate: { $lt: from }, status: InvoiceStatus.ISSUED })
      .exec();

    const openingCents = priorInvoices.reduce((sum, i) => sum + this.toCents(i.total), 0);
    // A refunded invoice is money returned, so it is no more a receivable than
    // a cancelled one. Counting it as invoiced but never as paid — which is
    // what excluding only CANCELLED does — overstates the closing balance by
    // its full amount, permanently, for every refund the lab ever issues.
    const invoicedCents = periodInvoices
      .filter((i) => i.status !== InvoiceStatus.CANCELLED && i.status !== InvoiceStatus.REFUNDED)
      .reduce((sum, i) => sum + this.toCents(i.total), 0);
    const paidCents = periodInvoices
      .filter((i) => i.status === InvoiceStatus.PAID)
      .reduce((sum, i) => sum + this.toCents(i.total), 0);
    const closingCents = openingCents + invoicedCents - paidCents;

    const existing = await this.statements
      .findOne({ dentistId, periodYear: year, periodMonth: month })
      .exec();

    const figures = {
      openingBalance: this.fromCents(openingCents),
      totalInvoiced: this.fromCents(invoicedCents),
      totalPaid: this.fromCents(paidCents),
      closingBalance: this.fromCents(closingCents),
    };

    const statement = existing
      ? await Object.assign(existing, figures).save()
      : await this.statements.create({
          dentistId,
          periodYear: year,
          periodMonth: month,
          ...figures,
        });

    // Render and cache the PDF so downloads are instant.
    await this.renderAndStorePdf(statement, dentist, periodInvoices);

    return this.findByIdOrFail(statement.id);
  }

  /** The non-draft invoices a statement covers, oldest first. */
  private periodInvoices(dentistId: string, from: string, to: string): Promise<Invoice[]> {
    return this.invoices
      .find({
        dentistId,
        issueDate: { $gte: from, $lte: to },
        status: { $ne: InvoiceStatus.DRAFT },
      })
      .sort({ issueDate: 1 })
      .exec();
  }

  /**
   * Render a statement PDF from the figures already stored on the row, cache
   * the blob, and point the row at it.
   *
   * It renders what it is given and recomputes nothing — that is the whole
   * point of it being separate from `generate`. Restating a statement is a
   * deliberate act (a correction), never a side effect of producing the file.
   */
  private async renderAndStorePdf(
    statement: MonthlyStatement,
    dentist: Dentist,
    invoices: Invoice[],
  ): Promise<string> {
    const buffer = await this.pdf.statement({ statement, dentist, invoices });
    const path = this.storage.statementPdfPath(
      statement.dentistId,
      statement.periodYear,
      statement.periodMonth,
    );
    await this.storage.save(path, buffer);
    if (statement.pdfPath !== path) {
      await this.statements.updateOne({ _id: statement.id }, { pdfPath: path }).exec();
    }
    return path;
  }

  /** Generate statements for every active dentist for a period. */
  async generateAll(year: number, month: number): Promise<{ created: number }> {
    const dentists = await this.dentists.find().populate('user').exec();
    const active = dentists.filter((d) => d.user?.status === UserStatus.ACTIVE);

    let created = 0;
    for (const dentist of active) {
      try {
        await this.generate(dentist.id, year, month);
        created += 1;
      } catch (err) {
        // One bad dentist must not abort the whole monthly run.
        this.logger.error(
          `Statement generation failed for dentist ${dentist.id}: ${String(err)}`,
        );
      }
    }
    return { created };
  }

  /** Email a generated statement to its dentist. */
  async send(id: string): Promise<void> {
    const statement = await this.findByIdOrFail(id);
    if (!statement.dentist?.userId) {
      throw new NotFoundException('This statement has no dentist account to notify');
    }

    const period = new Date(statement.periodYear, statement.periodMonth - 1, 1).toLocaleDateString(
      'en-US',
      { month: 'long', year: 'numeric' },
    );
    const tpl = emailTemplates.statementReady({
      period,
      total: statement.totalInvoiced,
      currency: this.app.defaultCurrency,
      url: `${this.app.webUrl}/statements/${statement.id}`,
    });

    await this.notifications.notify({
      userId: statement.dentist.userId,
      type: NotificationType.STATEMENT_READY,
      subject: tpl.subject,
      body: `Your statement for ${period} is ready.`,
      email: { html: tpl.html, text: tpl.text },
    });
    await this.statements.updateOne({ _id: id }, { sentAt: new Date() }).exec();
  }

  /** Serve the statement PDF, re-rendering if the cached blob is missing. */
  async pdfFor(id: string, user: AuthenticatedUser): Promise<{ buffer: Buffer; filename: string }> {
    const statement = await this.findScoped(id, user);
    const filename = `statement-${statement.periodYear}-${String(statement.periodMonth).padStart(2, '0')}.pdf`;
    const path =
      statement.pdfPath ??
      this.storage.statementPdfPath(statement.dentistId, statement.periodYear, statement.periodMonth);

    if (await this.storage.exists(path)) {
      return { buffer: await this.storage.read(path), filename };
    }

    // The blob is missing — cleared storage, a restore, a write that never
    // landed. Re-render it, but only re-render: calling `generate` here would
    // recompute the totals against *today's* invoice statuses, so downloading
    // a March statement in July could quietly rewrite what March said.
    if (!statement.dentist) {
      throw new NotFoundException('This statement has no dentist on record to render');
    }
    const { from, to } = monthRange(statement.periodYear, statement.periodMonth);
    const rendered = await this.renderAndStorePdf(
      statement,
      statement.dentist,
      await this.periodInvoices(statement.dentistId, from, to),
    );
    return { buffer: await this.storage.read(rendered), filename };
  }
}
