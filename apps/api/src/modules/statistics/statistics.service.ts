import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceStatus, UserStatus } from '@dental/shared-types';
import { DentalCase, Dentist, Invoice, User } from '../../database/entities';

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
 * Read-only reporting queries for the admin dashboard. Aggregation runs in SQL
 * rather than in JavaScript so the numbers stay correct as the dataset grows.
 */
@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(DentalCase) private readonly cases: Repository<DentalCase>,
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(Dentist) private readonly dentists: Repository<Dentist>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private money(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private sumTotals(rows: Array<{ total: string }>): string {
    return this.money(rows.reduce((sum, r) => sum + Math.round(Number(r.total) * 100), 0));
  }

  async kpis(): Promise<AdminKpis> {
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
      this.cases
        .createQueryBuilder('c')
        .where('c.submittedAt >= CURRENT_DATE')
        .getCount(),
      this.cases
        .createQueryBuilder('c')
        .where("c.submittedAt >= date_trunc('week', CURRENT_DATE)")
        .getCount(),
      this.cases
        .createQueryBuilder('c')
        .where("c.submittedAt >= date_trunc('month', CURRENT_DATE)")
        .getCount(),
      this.cases
        .createQueryBuilder('c')
        .leftJoin('c.currentStatus', 'status')
        .where('status.isTerminal = false')
        .getCount(),
      this.dentists
        .createQueryBuilder('d')
        .leftJoin('d.user', 'user')
        .where('user.status = :status', { status: UserStatus.ACTIVE })
        .getCount(),
      this.invoices
        .createQueryBuilder('i')
        .select('i.total', 'total')
        .where('i.status = :paid', { paid: InvoiceStatus.PAID })
        .andWhere("i.paidAt >= date_trunc('month', CURRENT_DATE)")
        .getRawMany<{ total: string }>(),
      this.invoices
        .createQueryBuilder('i')
        .select('i.total', 'total')
        .where('i.status = :issued', { issued: InvoiceStatus.ISSUED })
        .getRawMany<{ total: string }>(),
      this.cases
        .createQueryBuilder('c')
        .select(
          'AVG(EXTRACT(EPOCH FROM (c.completedAt - c.submittedAt)) / 86400)',
          'days',
        )
        .where('c.completedAt IS NOT NULL')
        .getRawOne<{ days: string | null }>(),
    ]);

    const avg = turnaround?.days === null || turnaround?.days === undefined
      ? null
      : Number(turnaround.days);

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
    const rows = await this.cases
      .createQueryBuilder('c')
      .select(`to_char(date_trunc('${granularity}', c.submittedAt), 'YYYY-MM-DD')`, 'period')
      .addSelect('COUNT(*)', 'value')
      .where('c.submittedAt >= :from AND c.submittedAt < (:to::date + INTERVAL \'1 day\')', range)
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; value: string }>();
    return rows.map((r) => ({ period: r.period, value: Number(r.value) }));
  }

  /** Revenue recognised (paid invoices) per period. */
  async revenueOverTime(range: DateRange, granularity: 'day' | 'month' = 'month'): Promise<TimeSeriesPoint[]> {
    const rows = await this.invoices
      .createQueryBuilder('i')
      .select(`to_char(date_trunc('${granularity}', i.paidAt), 'YYYY-MM-DD')`, 'period')
      .addSelect('SUM(i.total)', 'value')
      .where('i.status = :paid', { paid: InvoiceStatus.PAID })
      .andWhere('i.paidAt >= :from AND i.paidAt < (:to::date + INTERVAL \'1 day\')', range)
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany<{ period: string; value: string }>();
    return rows.map((r) => ({ period: r.period, value: Number(r.value) }));
  }

  async caseTypeDistribution(range: DateRange): Promise<DistributionSlice[]> {
    const rows = await this.cases
      .createQueryBuilder('c')
      .leftJoin('c.caseType', 'caseType')
      .select('caseType.name', 'label')
      .addSelect('COUNT(*)', 'value')
      .where('c.submittedAt >= :from AND c.submittedAt < (:to::date + INTERVAL \'1 day\')', range)
      .groupBy('caseType.name')
      .orderBy('value', 'DESC')
      .getRawMany<{ label: string; value: string }>();
    return rows.map((r) => ({ label: r.label ?? 'Unknown', value: Number(r.value) }));
  }

  async statusDistribution(): Promise<DistributionSlice[]> {
    const rows = await this.cases
      .createQueryBuilder('c')
      .leftJoin('c.currentStatus', 'status')
      .select('status.label', 'label')
      .addSelect('status.color', 'color')
      .addSelect('COUNT(*)', 'value')
      .groupBy('status.label')
      .addGroupBy('status.color')
      .addGroupBy('status.sortOrder')
      .orderBy('status.sortOrder', 'ASC')
      .getRawMany<{ label: string; color: string; value: string }>();
    return rows.map((r) => ({ label: r.label ?? 'Unknown', color: r.color, value: Number(r.value) }));
  }

  /** Dentist league table: case volume and revenue over a range. */
  async dentistRanking(range: DateRange, limit = 10): Promise<
    Array<{ dentistId: string; name: string; clinicName: string | null; cases: number; revenue: string }>
  > {
    const rows = await this.cases
      .createQueryBuilder('c')
      .leftJoin('c.dentist', 'dentist')
      .leftJoin('dentist.user', 'user')
      .select('dentist.id', 'dentistId')
      .addSelect("user.firstName || ' ' || user.lastName", 'name')
      .addSelect('dentist.clinicName', 'clinicName')
      .addSelect('COUNT(c.id)', 'cases')
      .where('c.submittedAt >= :from AND c.submittedAt < (:to::date + INTERVAL \'1 day\')', range)
      .groupBy('dentist.id')
      .addGroupBy('user.firstName')
      .addGroupBy('user.lastName')
      .addGroupBy('dentist.clinicName')
      .orderBy('cases', 'DESC')
      .limit(limit)
      .getRawMany<{ dentistId: string; name: string; clinicName: string | null; cases: string }>();

    // Revenue is invoice-based, so it is resolved per dentist alongside volume.
    const revenue = await this.invoices
      .createQueryBuilder('i')
      .select('i.dentistId', 'dentistId')
      .addSelect('SUM(i.total)', 'revenue')
      .where('i.status = :paid', { paid: InvoiceStatus.PAID })
      .andWhere('i.paidAt >= :from AND i.paidAt < (:to::date + INTERVAL \'1 day\')', range)
      .groupBy('i.dentistId')
      .getRawMany<{ dentistId: string; revenue: string }>();
    const revenueByDentist = new Map(revenue.map((r) => [r.dentistId, r.revenue]));

    return rows.map((r) => ({
      dentistId: r.dentistId,
      name: r.name ?? 'Unknown',
      clinicName: r.clinicName,
      cases: Number(r.cases),
      revenue: Number(revenueByDentist.get(r.dentistId) ?? 0).toFixed(2),
    }));
  }

  /** Revenue split by case type, via the invoice's originating case. */
  async revenueByCaseType(range: DateRange): Promise<DistributionSlice[]> {
    const rows = await this.invoices
      .createQueryBuilder('i')
      .leftJoin('i.case', 'c')
      .leftJoin('c.caseType', 'caseType')
      .select('caseType.name', 'label')
      .addSelect('SUM(i.total)', 'value')
      .where('i.status = :paid', { paid: InvoiceStatus.PAID })
      .andWhere('i.paidAt >= :from AND i.paidAt < (:to::date + INTERVAL \'1 day\')', range)
      .andWhere('caseType.name IS NOT NULL')
      .groupBy('caseType.name')
      .orderBy('value', 'DESC')
      .getRawMany<{ label: string; value: string }>();
    return rows.map((r) => ({ label: r.label, value: Number(r.value) }));
  }

  /** Mean turnaround per case type — the workload/efficiency report. */
  async turnaroundByCaseType(range: DateRange): Promise<Array<{ label: string; days: number; cases: number }>> {
    const rows = await this.cases
      .createQueryBuilder('c')
      .leftJoin('c.caseType', 'caseType')
      .select('caseType.name', 'label')
      .addSelect('AVG(EXTRACT(EPOCH FROM (c.completedAt - c.submittedAt)) / 86400)', 'days')
      .addSelect('COUNT(*)', 'cases')
      .where('c.completedAt IS NOT NULL')
      .andWhere('c.completedAt >= :from AND c.completedAt < (:to::date + INTERVAL \'1 day\')', range)
      .groupBy('caseType.name')
      .orderBy('days', 'DESC')
      .getRawMany<{ label: string; days: string; cases: string }>();
    return rows.map((r) => ({
      label: r.label ?? 'Unknown',
      days: Number(Number(r.days).toFixed(1)),
      cases: Number(r.cases),
    }));
  }

  /** Recent platform activity for the dashboard feed. */
  async recentActivity(limit = 10): Promise<
    Array<{ id: string; reference: string; dentistName: string; status: string; at: string }>
  > {
    const rows = await this.cases
      .createQueryBuilder('c')
      .leftJoin('c.dentist', 'dentist')
      .leftJoin('dentist.user', 'user')
      .leftJoin('c.currentStatus', 'status')
      .select('c.id', 'id')
      .addSelect('c.reference', 'reference')
      .addSelect("user.firstName || ' ' || user.lastName", 'dentistName')
      .addSelect('status.label', 'status')
      .addSelect('c.updatedAt', 'at')
      .orderBy('c.updatedAt', 'DESC')
      .limit(limit)
      .getRawMany<{ id: string; reference: string; dentistName: string; status: string; at: Date }>();
    return rows.map((r) => ({ ...r, at: new Date(r.at).toISOString() }));
  }
}
