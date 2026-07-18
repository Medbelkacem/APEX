import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
    @InjectRepository(MonthlyStatement)
    private readonly statements: Repository<MonthlyStatement>,
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(Dentist) private readonly dentists: Repository<Dentist>,
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
    const dentist = await this.dentists.findOne({ where: { userId } });
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
    const qb: SelectQueryBuilder<MonthlyStatement> = this.statements
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.dentist', 'dentist')
      .leftJoinAndSelect('dentist.user', 'dentistUser');

    if (this.isAdmin(user)) {
      if (query.dentistId) qb.andWhere('s.dentistId = :dentistId', { dentistId: query.dentistId });
    } else {
      const dentist = await this.dentistForUser(user.id);
      qb.andWhere('s.dentistId = :ownId', { ownId: dentist.id });
    }
    if (query.year) qb.andWhere('s.periodYear = :year', { year: query.year });

    qb.orderBy('s.periodYear', 'DESC').addOrderBy('s.periodMonth', 'DESC').skip(skip).take(take);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async findByIdOrFail(id: string): Promise<MonthlyStatement> {
    const statement = await this.statements.findOne({
      where: { id },
      relations: { dentist: { user: true } },
    });
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
    const dentist = await this.dentists.findOne({
      where: { id: dentistId },
      relations: { user: true },
    });
    if (!dentist) throw new NotFoundException('Dentist not found');

    const { from, to } = monthRange(year, month);
    const periodInvoices = await this.invoices
      .createQueryBuilder('invoice')
      .where('invoice.dentistId = :dentistId', { dentistId })
      .andWhere('invoice.issueDate BETWEEN :from AND :to', { from, to })
      .andWhere('invoice.status != :draft', { draft: InvoiceStatus.DRAFT })
      .orderBy('invoice.issueDate', 'ASC')
      .getMany();

    // Opening balance = everything still owed from before this period.
    const priorInvoices = await this.invoices
      .createQueryBuilder('invoice')
      .where('invoice.dentistId = :dentistId', { dentistId })
      .andWhere('invoice.issueDate < :from', { from })
      .andWhere('invoice.status = :issued', { issued: InvoiceStatus.ISSUED })
      .getMany();

    const openingCents = priorInvoices.reduce((sum, i) => sum + this.toCents(i.total), 0);
    const invoicedCents = periodInvoices
      .filter((i) => i.status !== InvoiceStatus.CANCELLED)
      .reduce((sum, i) => sum + this.toCents(i.total), 0);
    const paidCents = periodInvoices
      .filter((i) => i.status === InvoiceStatus.PAID)
      .reduce((sum, i) => sum + this.toCents(i.total), 0);
    const closingCents = openingCents + invoicedCents - paidCents;

    const existing = await this.statements.findOne({
      where: { dentistId, periodYear: year, periodMonth: month },
    });

    const figures = {
      openingBalance: this.fromCents(openingCents),
      totalInvoiced: this.fromCents(invoicedCents),
      totalPaid: this.fromCents(paidCents),
      closingBalance: this.fromCents(closingCents),
    };

    const statement = existing
      ? await this.statements.save(Object.assign(existing, figures))
      : await this.statements.save(
          this.statements.create({
            dentistId,
            periodYear: year,
            periodMonth: month,
            ...figures,
          }),
        );

    // Render and cache the PDF so downloads are instant.
    const buffer = await this.pdf.statement({
      statement,
      dentist,
      invoices: periodInvoices,
    });
    const path = this.storage.statementPdfPath(dentistId, year, month);
    await this.storage.save(path, buffer);
    await this.statements.update(statement.id, { pdfPath: path });

    return this.findByIdOrFail(statement.id);
  }

  /** Generate statements for every active dentist for a period. */
  async generateAll(year: number, month: number): Promise<{ created: number }> {
    const dentists = await this.dentists
      .createQueryBuilder('dentist')
      .leftJoin('dentist.user', 'user')
      .where('user.status = :status', { status: UserStatus.ACTIVE })
      .getMany();

    let created = 0;
    for (const dentist of dentists) {
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
    await this.statements.update(id, { sentAt: new Date() });
  }

  /** Serve the statement PDF, re-rendering if the cached blob is missing. */
  async pdfFor(id: string, user: AuthenticatedUser): Promise<{ buffer: Buffer; filename: string }> {
    const statement = await this.findScoped(id, user);
    const path =
      statement.pdfPath ??
      this.storage.statementPdfPath(statement.dentistId, statement.periodYear, statement.periodMonth);

    if (await this.storage.exists(path)) {
      return {
        buffer: await this.storage.read(path),
        filename: `statement-${statement.periodYear}-${String(statement.periodMonth).padStart(2, '0')}.pdf`,
      };
    }

    const regenerated = await this.generate(
      statement.dentistId,
      statement.periodYear,
      statement.periodMonth,
    );
    return {
      buffer: await this.storage.read(regenerated.pdfPath!),
      filename: `statement-${statement.periodYear}-${String(statement.periodMonth).padStart(2, '0')}.pdf`,
    };
  }
}
