import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { Response } from 'express';
import { UserRole } from '@dental/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { StatisticsService } from './statistics.service';

/** Defaults to the trailing 30 days when no range is supplied. */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

export const rangeSchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  granularity: z.enum(['day', 'month']).optional(),
});
export class RangeDto extends createZodDto(rangeSchema) {}

export const reportSchema = rangeSchema.extend({
  report: z.enum(['dentist-ranking', 'revenue-by-case-type', 'turnaround']),
});
export class ReportDto extends createZodDto(reportSchema) {}

@ApiTags('statistics')
@Controller('statistics')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  private resolveRange(query: RangeDto): { from: string; to: string } {
    const fallback = defaultRange();
    return { from: query.from ?? fallback.from, to: query.to ?? fallback.to };
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Headline KPI cards for the admin dashboard.' })
  kpis() {
    return this.statistics.kpis();
  }

  @Get('overview')
  @ApiOperation({ summary: 'Every dashboard chart in a single round trip.' })
  async overview(@Query() query: RangeDto) {
    const range = this.resolveRange(query);
    const [kpis, casesOverTime, revenueOverTime, caseTypes, statuses, activity] =
      await Promise.all([
        this.statistics.kpis(),
        this.statistics.casesOverTime(range, query.granularity ?? 'day'),
        this.statistics.revenueOverTime(range, query.granularity ?? 'month'),
        this.statistics.caseTypeDistribution(range),
        this.statistics.statusDistribution(),
        this.statistics.recentActivity(8),
      ]);
    return { range, kpis, casesOverTime, revenueOverTime, caseTypes, statuses, activity };
  }

  @Get('reports')
  @ApiOperation({ summary: 'Pre-built report data by name.' })
  async report(@Query() query: ReportDto) {
    const range = this.resolveRange(query);
    switch (query.report) {
      case 'dentist-ranking':
        return { range, rows: await this.statistics.dentistRanking(range, 25) };
      case 'revenue-by-case-type':
        return { range, rows: await this.statistics.revenueByCaseType(range) };
      case 'turnaround':
        return { range, rows: await this.statistics.turnaroundByCaseType(range) };
    }
  }

  @Get('reports/export')
  @ApiOperation({ summary: 'Download a report as CSV.' })
  async exportCsv(@Query() query: ReportDto, @Res() res: Response): Promise<void> {
    const range = this.resolveRange(query);
    const { headers, rows } = await this.buildCsvRows(query.report, range);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => this.escapeCsv(cell)).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${query.report}-${range.from}-to-${range.to}.csv"`,
    );
    // Byte-order mark so Excel detects UTF-8 instead of mangling accents.
    res.end(`\uFEFF${csv}`);
  }

  private async buildCsvRows(
    report: ReportDto['report'],
    range: { from: string; to: string },
  ): Promise<{ headers: string[]; rows: string[][] }> {
    if (report === 'dentist-ranking') {
      const rows = await this.statistics.dentistRanking(range, 500);
      return {
        headers: ['Dentist', 'Clinic', 'Cases', 'Revenue'],
        rows: rows.map((r) => [r.name, r.clinicName ?? '', String(r.cases), r.revenue]),
      };
    }
    if (report === 'revenue-by-case-type') {
      const rows = await this.statistics.revenueByCaseType(range);
      return {
        headers: ['Case type', 'Revenue'],
        rows: rows.map((r) => [r.label, r.value.toFixed(2)]),
      };
    }
    const rows = await this.statistics.turnaroundByCaseType(range);
    return {
      headers: ['Case type', 'Average days', 'Cases'],
      rows: rows.map((r) => [r.label, String(r.days), String(r.cases)]),
    };
  }

  /** Quote fields containing a delimiter, quote, or newline (RFC 4180). */
  private escapeCsv(value: string): string {
    if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }
}
