import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';
import { PricingRule, PricingRuleDocument } from '../../database/entities';
import { AppConfig } from '../../config/app.config';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import {
  CreatePricingRuleDto,
  ListPricingRulesDto,
  UpdatePricingRuleDto,
} from './pricing.dto';

export interface PriceQuote {
  price: string;
  currency: string;
  /** The rule that produced this price, or null when falling back to zero. */
  ruleId: string | null;
  /** How the rule was matched, for display in the admin UI. */
  basis: 'tier+material' | 'tier' | 'material' | 'default' | 'none';
}

@Injectable()
export class PricingService {
  constructor(
    @InjectModel(PricingRule.name) private readonly rules: Model<PricingRule>,
    private readonly config: ConfigService,
  ) {}

  private get defaultCurrency(): string {
    return this.config.get<AppConfig>('app')!.defaultCurrency;
  }

  async list(query: ListPricingRulesDto): Promise<Paginated<PricingRule>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const filter: FilterQuery<PricingRule> = {};
    if (query.caseTypeId) filter.caseTypeId = query.caseTypeId;
    if (query.dentistTier) filter.dentistTier = query.dentistTier;
    if (!query.includeInactive) filter.isActive = true;

    // Ordering keys on the joined case type's sortOrder, which a find() cannot
    // sort by — so match, populate, and sort in memory. The pricing catalog is
    // an admin-sized dataset, so materialising it fully is cheap.
    const all = await this.rules.find(filter).populate('caseType').exec();
    all.sort((a, b) => {
      const orderA = a.caseType?.sortOrder ?? 0;
      const orderB = b.caseType?.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      // dentistTier ASC, NULLS FIRST.
      if (a.dentistTier === b.dentistTier) return 0;
      if (a.dentistTier === null) return -1;
      if (b.dentistTier === null) return 1;
      return a.dentistTier < b.dentistTier ? -1 : 1;
    });

    return paginate(all.slice(skip, skip + take), all.length, page, limit);
  }

  async findByIdOrFail(id: string): Promise<PricingRuleDocument> {
    const rule = await this.rules.findById(id).populate('caseType').exec();
    if (!rule) throw new NotFoundException('Pricing rule not found');
    return rule;
  }

  async create(dto: CreatePricingRuleDto): Promise<PricingRule> {
    return this.rules.create({
      caseTypeId: dto.caseTypeId,
      dentistTier: dto.dentistTier ?? null,
      material: dto.material ?? null,
      price: dto.price,
      currency: dto.currency ?? this.defaultCurrency,
      effectiveFrom: dto.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      effectiveTo: dto.effectiveTo ?? null,
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdatePricingRuleDto): Promise<PricingRule> {
    const rule = await this.findByIdOrFail(id);
    Object.assign(rule, {
      ...(dto.dentistTier !== undefined && { dentistTier: dto.dentistTier }),
      ...(dto.material !== undefined && { material: dto.material }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.effectiveFrom !== undefined && { effectiveFrom: dto.effectiveFrom }),
      ...(dto.effectiveTo !== undefined && { effectiveTo: dto.effectiveTo }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return rule.save();
  }

  async remove(id: string): Promise<void> {
    await this.findByIdOrFail(id);
    await this.rules.updateOne({ _id: id }, { deletedAt: new Date() }).exec();
  }

  /**
   * Resolve the price for a case. Rules are matched most-specific first —
   * a tier+material rule beats a tier rule, which beats a material rule, which
   * beats the case type's default. Only rules active on `onDate` are considered.
   */
  async quote(
    caseTypeId: string,
    material?: string | null,
    dentistTier?: string | null,
    onDate = new Date().toISOString().slice(0, 10),
  ): Promise<PriceQuote> {
    const candidates = await this.rules
      .find({
        caseTypeId,
        isActive: true,
        effectiveFrom: { $lte: onDate },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: onDate } }],
      })
      // Newest effective date wins among otherwise equally specific rules.
      .sort({ effectiveFrom: -1 })
      .exec();

    const tierMatches = (rule: PricingRule) =>
      Boolean(dentistTier) && rule.dentistTier === dentistTier;
    const materialMatches = (rule: PricingRule) =>
      Boolean(material) && rule.material?.toLowerCase() === material?.toLowerCase();

    const tiers: Array<[PriceQuote['basis'], (r: PricingRule) => boolean]> = [
      ['tier+material', (r) => tierMatches(r) && materialMatches(r)],
      ['tier', (r) => tierMatches(r) && r.material === null],
      ['material', (r) => r.dentistTier === null && materialMatches(r)],
      ['default', (r) => r.dentistTier === null && r.material === null],
    ];

    for (const [basis, predicate] of tiers) {
      const match = candidates.find(predicate);
      if (match) {
        return { price: match.price, currency: match.currency, ruleId: match.id, basis };
      }
    }

    // No rule configured — the admin prices this case manually on the invoice.
    return { price: '0.00', currency: this.defaultCurrency, ruleId: null, basis: 'none' };
  }
}
