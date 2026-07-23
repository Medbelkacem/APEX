import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InvoiceStatus, UserStatus } from '@dental/shared-types';
import { DentalCase, Dentist, Invoice, User } from '../../database/entities';
import { CatalogService } from '../catalog/catalog.service';

export interface DateRange {
  from: string;
  to: string;
}

export interface AdminKpis {
  casesToday: number;
  casesThisWeek: number;
  casesThisMonth: number;
  activeCases: number;
  activeDentists: number;
  revenueThisMonth: string;
  outstandingTotal: string;
  /** Mean days from submission to completion, or null when nothing is done yet. */
  avgTurnaroundDays: number | null;
}

export interface TimeSeriesPoint {
  period: string;
  value: number;
}

export interface DistributionSlice {
  label: string;
  value: number;
  color?: string;
}

/**
 * Read-only reporting queries for the admin dashboard. Aggregation runs in the
 * database (MongoDB aggregation pipelines) rather than in JavaScript so the
 * numbers stay correct as the dataset grows.
 *
 * Soft-deleted rows are excluded explicitly with `{ deletedAt: null }` in every
 * pipeline — aggregation bypasses the schema-level soft-delete filter that
 * `find`/`count` get automatically.
 */
@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(DentalCase.name) private readonly cases: Model<DentalCase>,
    @InjectModel(Invoice.name) private readonly invoices: Model<Invoice>,
    @InjectModel(Dentist.name) private readonly dentists: Model<Dentist>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly catalog: CatalogService,
  ) {}

  // ── Date helpers (all UTC, matching DEFAULT_TIMEZONE) ──────────────────────

  private startOfTodayUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  /** Monday 00:00 UTC of the current week (Postgres `date_trunc('week')`). */
  private startOfWeekUTC(): Date {
    const start = this.startOfTodayUTC();
    const day = start.getUTCDay(); // 0=Sun … 6=Sat
    const backToMonday = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - backToMonday);
    return start;
  }

  private startOfMonthUTC(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  /** [from 00:00, to+1day 00:00) — the inclusive-end-day window the SQL used. */
  private rangeBounds(range: DateRange): { from: Date; toExclusive: Date } {
    const from = new Date(`${range.from}T00:00:00.000Z`);
    const toExclusive = new Date(`${range.to}T00:00:00.000Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    return { from, toExclusive };
  }

  private money(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private sumTotals(rows: Array<{ total: string }>): string {
    return this.money(rows.reduce((sum, r) => sum + Math.round(Number(r.total) * 100), 0));
  }

  private toNumber(value: unknown): number {
    return value == null ? 0 : Number((value as { toString(): string }).toString());
  }

  async kpis(): Promise<AdminKpis> {
    const statuses = await this.catalog.listStatuses(true);
    const activeStatusIds = statuses.filter((s) => !s.isTerminal).map((s) => s.id);
    const activeUserIds = await this.users.find({ status: UserStatus.ACTIVE }).distinct('_id').exec();

    const [
      casesToday,
      casesThisWeek,
      casesThisMonth,
      activeCases,
      activeDentists,
      revenueRows,
      outstandingRows,
      turnaround,
    ] = await Promise.all([
      this.cases.countDocuments({ submittedAt: { $gte: this.startOfTodayUTC() } }).exec(),
      this.cases.countDocuments({ submittedAt: { $gte: this.startOfWeekUTC() } }).exec(),
      this.cases.countDocuments({ submittedAt: { $gte: this.startOfMonthUTC() } }).exec(),
      this.cases.countDocuments({ currentStatusId: { $in: activeStatusIds } }).exec(),
      this.dentists.countDocuments({ userId: { $in: activeUserIds } }).exec(),
      this.invoices
        .find({ status: InvoiceStatus.PAID, paidAt: { $gte: this.startOfMonthUTC() } })
        .select('total')
        .exec(),
      this.invoices.find({ status: InvoiceStatus.ISSUED }).select('total').exec(),
      this.cases
        .aggregate<{ days: number }>([
          { $match: { deletedAt: null, completedAt: { $ne: null } } },
          {
            $group: {
              _id: null,
              days: {
                $avg: {
                  $divide: [{ $subtract: ['$completedAt', '$submittedAt'] }, 86400000],
                },
              },
            },
          },
        ])
        .exec(),
    ]);

    const avgDays = turnaround[0]?.days;
    const avg = avgDays === undefined || avgDays === null ? null : Number(avgDays);

    return {
      casesToday,
      casesThisWeek,
      casesThisMonth,
      activeCases,
      activeDentists,
      revenueThisMonth: this.sumTotals(revenueRows),
      outstandingTotal: this.sumTotals(outstandingRows),
      avgTurnaroundDays: avg === null || Number.isNaN(avg) ? null : Number(avg.toFixed(1)),
    };
  }

  /** Cases submitted per day/month across a range. */
  async casesOverTime(range: DateRange, granularity: 'day' | 'month' = 'day'): Promise<TimeSeriesPoint[]> {
    const { from, toExclusive } = this.rangeBounds(range);
    const rows = await this.cases
      .aggregate<{ _id: string; value: number }>([
        { $match: { deletedAt: null, submittedAt: { $gte: from, $lt: toExclusive } } },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $dateTrunc: { date: '$submittedAt', unit: granularity, timezone: 'UTC' } },
                timezone: 'UTC',
              },
            },
            value: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return rows.map((r) => ({ period: r._id, value: r.value }));
  }

  /** Revenue recognised (paid invoices) per period. */
  async revenueOverTime(range: DateRange, granularity: 'day' | 'month' = 'month'): Promise<TimeSeriesPoint[]> {
    const { from, toExclusive } = this.rangeBounds(range);
    const rows = await this.invoices
      .aggregate<{ _id: string; value: unknown }>([
        {
          $match: {
            deletedAt: null,
            status: InvoiceStatus.PAID,
            paidAt: { $gte: from, $lt: toExclusive },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $dateTrunc: { date: '$paidAt', unit: granularity, timezone: 'UTC' } },
                timezone: 'UTC',
              },
            },
            value: { $sum: { $toDecimal: '$total' } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return rows.map((r) => ({ period: r._id, value: this.toNumber(r.value) }));
  }

  async caseTypeDistribution(range: DateRange): Promise<DistributionSlice[]> {
    const { from, toExclusive } = this.rangeBounds(range);
    const rows = await this.cases
      .aggregate<{ _id: string | null; value: number }>([
        { $match: { deletedAt: null, submittedAt: { $gte: from, $lt: toExclusive } } },
        { $lookup: { from: 'case_types', localField: 'caseTypeId', foreignField: '_id', as: 'caseType' } },
        { $unwind: { path: '$caseType', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$caseType.name', value: { $sum: 1 } } },
        { $sort: { value: -1 } },
      ])
      .exec();
    return rows.map((r) => ({ label: r._id ?? 'Unknown', value: r.value }));
  }

  async statusDistribution(): Promise<DistributionSlice[]> {
    const rows = await this.cases
      .aggregate<{ _id: { label: string; color: string; sortOrder: number }; value: number }>([
        { $match: { deletedAt: null } },
        { $lookup: { from: 'case_statuses', localField: 'currentStatusId', foreignField: '_id', as: 'status' } },
        { $unwind: { path: '$status', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { label: '$status.label', color: '$status.color', sortOrder: '$status.sortOrder' },
            value: { $sum: 1 },
          },
        },
        { $sort: { '_id.sortOrder': 1 } },
      ])
      .exec();
    return rows.map((r) => ({ label: r._id.label ?? 'Unknown', color: r._id.color, value: r.value }));
  }

  /** Dentist league table: case volume and revenue over a range. */
  async dentistRanking(range: DateRange, limit = 10): Promise<
    Array<{ dentistId: string; name: string; clinicName: string | null; cases: number; revenue: string }>
  > {
    const { from, toExclusive } = this.rangeBounds(range);
    const rows = await this.cases
      .aggregate<{
        dentistId: string;
        name: string | null;
        clinicName: string | null;
        cases: number;
      }>([
        { $match: { deletedAt: null, submittedAt: { $gte: from, $lt: toExclusive } } },
        { $group: { _id: '$dentistId', cases: { $sum: 1 } } },
        { $sort: { cases: -1 } },
        { $limit: limit },
        { $lookup: { from: 'dentists', localField: '_id', foreignField: '_id', as: 'dentist' } },
        { $unwind: { path: '$dentist', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'users', localField: 'dentist.userId', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            dentistId: '$_id',
            cases: 1,
            clinicName: '$dentist.clinicName',
            name: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ['$user.firstName', ''] },
                    ' ',
                    { $ifNull: ['$user.lastName', ''] },
                  ],
                },
              },
            },
          },
        },
      ])
      .exec();

    // Revenue is invoice-based, so it is resolved per dentist alongside volume.
    const revenue = await this.invoices
      .aggregate<{ _id: string; revenue: unknown }>([
        {
          $match: {
            deletedAt: null,
            status: InvoiceStatus.PAID,
            paidAt: { $gte: from, $lt: toExclusive },
          },
        },
        { $group: { _id: '$dentistId', revenue: { $sum: { $toDecimal: '$total' } } } },
      ])
      .exec();
    const revenueByDentist = new Map(revenue.map((r) => [r._id, this.toNumber(r.revenue)]));

    return rows.map((r) => ({
      dentistId: r.dentistId,
      name: r.name || 'Unknown',
      clinicName: r.clinicName,
      cases: r.cases,
      revenue: (revenueByDentist.get(r.dentistId) ?? 0).toFixed(2),
    }));
  }

  /** Revenue split by case type, via the invoice's originating case. */
  async revenueByCaseType(range: DateRange): Promise<DistributionSlice[]> {
    const { from, toExclusive } = this.rangeBounds(range);
    const rows = await this.invoices
      .aggregate<{ _id: string; value: unknown }>([
        {
          $match: {
            deletedAt: null,
            status: InvoiceStatus.PAID,
            paidAt: { $gte: from, $lt: toExclusive },
          },
        },
        { $lookup: { from: 'cases', localField: 'caseId', foreignField: '_id', as: 'case' } },
        { $unwind: '$case' },
        { $lookup: { from: 'case_types', localField: 'case.caseTypeId', foreignField: '_id', as: 'caseType' } },
        { $unwind: '$caseType' },
        { $match: { 'caseType.name': { $ne: null } } },
        { $group: { _id: '$caseType.name', value: { $sum: { $toDecimal: '$total' } } } },
        { $sort: { value: -1 } },
      ])
      .exec();
    return rows.map((r) => ({ label: r._id, value: this.toNumber(r.value) }));
  }

  /** Mean turnaround per case type — the workload/efficiency report. */
  async turnaroundByCaseType(range: DateRange): Promise<Array<{ label: string; days: number; cases: number }>> {
    const { from, toExclusive } = this.rangeBounds(range);
    const rows = await this.cases
      .aggregate<{ _id: string | null; days: number; cases: number }>([
        {
          $match: {
            deletedAt: null,
            completedAt: { $ne: null, $gte: from, $lt: toExclusive },
          },
        },
        { $lookup: { from: 'case_types', localField: 'caseTypeId', foreignField: '_id', as: 'caseType' } },
        { $unwind: { path: '$caseType', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$caseType.name',
            days: { $avg: { $divide: [{ $subtract: ['$completedAt', '$submittedAt'] }, 86400000] } },
            cases: { $sum: 1 },
          },
        },
        { $sort: { days: -1 } },
      ])
      .exec();
    return rows.map((r) => ({
      label: r._id ?? 'Unknown',
      days: Number(Number(r.days).toFixed(1)),
      cases: r.cases,
    }));
  }

  /** Recent platform activity for the dashboard feed. */
  async recentActivity(limit = 10): Promise<
    Array<{ id: string; reference: string; dentistName: string; status: string; at: string }>
  > {
    const rows = await this.cases
      .find()
      .populate({ path: 'dentist', populate: { path: 'user' } })
      .populate('currentStatus')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();

    return rows.map((c) => ({
      id: c.id,
      reference: c.reference,
      dentistName: c.dentist?.user
        ? `${c.dentist.user.firstName} ${c.dentist.user.lastName}`.trim()
        : 'Unknown',
      status: c.currentStatus?.label ?? 'Unknown',
      at: c.updatedAt.toISOString(),
    }));
  }
}
