import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PlatformSetting } from '../../database/entities';
import { AuthConfig } from '../../config/auth.config';

/** Settings the platform reads at runtime, with their fallbacks. */
export const SETTING_KEYS = {
  taxRate: 'billing.tax_rate',
  paymentTermsDays: 'billing.payment_terms_days',
  currency: 'billing.currency',
  labName: 'brand.lab_name',
  labAddress: 'brand.lab_address',
  supportEmail: 'brand.support_email',
  stripeSecretKey: 'stripe.secret_key',
  stripePublishableKey: 'stripe.publishable_key',
  stripeWebhookSecret: 'stripe.webhook_secret',
  stripeMode: 'stripe.mode',
  smtpHost: 'smtp.host',
  smtpPort: 'smtp.port',
  smtpUser: 'smtp.user',
  smtpPassword: 'smtp.password',
} as const;

/** Keys whose values are encrypted at rest and redacted when listed. */
const SECRET_KEYS = new Set<string>([
  SETTING_KEYS.stripeSecretKey,
  SETTING_KEYS.stripeWebhookSecret,
  SETTING_KEYS.smtpPassword,
]);

const REDACTED = '••••••••';
const ALGORITHM = 'aes-256-gcm';

/**
 * Key/value platform configuration editable by a super admin. Secret values are
 * encrypted at rest with a key derived from JWT_SECRET, and are never returned
 * to the client — the API only reports whether a secret is set.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(PlatformSetting) private readonly repo: Repository<PlatformSetting>,
    private readonly config: ConfigService,
  ) {}

  /** 32-byte key derived from the app secret — no extra secret to manage. */
  private get encryptionKey(): Buffer {
    const secret = this.config.get<AuthConfig>('auth')!.jwtSecret;
    return createHash('sha256').update(`platform-settings:${secret}`).digest();
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  private decrypt(payload: string): string | null {
    try {
      const [ivPart, tagPart, dataPart] = payload.split('.');
      if (!ivPart || !tagPart || !dataPart) return null;
      const decipher = createDecipheriv(
        ALGORITHM,
        this.encryptionKey,
        Buffer.from(ivPart, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(dataPart, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // A rotated JWT_SECRET invalidates stored secrets; surface as "unset"
      // rather than crashing the request that needed it.
      this.logger.warn('Could not decrypt a platform setting — has JWT_SECRET been rotated?');
      return null;
    }
  }

  /** Raw value for internal callers, decrypting secrets as needed. */
  async get(key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    if (!row?.value) return null;
    return row.isSecret ? this.decrypt(row.value) : row.value;
  }

  async set(key: string, value: string | null, updatedByUserId?: string): Promise<void> {
    const isSecret = SECRET_KEYS.has(key);
    const stored = value === null || value === '' ? null : isSecret ? this.encrypt(value) : value;

    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      await this.repo.update(existing.id, {
        value: stored,
        isSecret,
        updatedByUserId: updatedByUserId ?? null,
      });
      return;
    }
    await this.repo.save(
      this.repo.create({ key, value: stored, isSecret, updatedByUserId: updatedByUserId ?? null }),
    );
  }

  /** Client-facing listing: secrets are reported as set/unset, never revealed. */
  async listRedacted(): Promise<
    Array<{ key: string; value: string | null; isSecret: boolean; isSet: boolean; updatedAt: Date | null }>
  > {
    const rows = await this.repo.find({ order: { key: 'ASC' } });
    const byKey = new Map(rows.map((row) => [row.key, row]));

    return Object.values(SETTING_KEYS).map((key) => {
      const row = byKey.get(key);
      const isSecret = SECRET_KEYS.has(key);
      const isSet = Boolean(row?.value);
      return {
        key,
        value: isSecret ? (isSet ? REDACTED : null) : (row?.value ?? null),
        isSecret,
        isSet,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  // ── Typed accessors used across the platform ─────────────────────────────

  /** Tax as a fraction (0.2 = 20%). Falls back to zero when unconfigured. */
  async taxRate(): Promise<number> {
    const raw = await this.get(SETTING_KEYS.taxRate);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return 0;
    return parsed;
  }

  async paymentTermsDays(): Promise<number> {
    const raw = await this.get(SETTING_KEYS.paymentTermsDays);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 30;
  }

  /**
   * Stripe credentials, preferring the database (super-admin editable) and
   * falling back to environment configuration.
   */
  async stripeConfig(): Promise<{
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
    mode: string;
  }> {
    const [secretKey, publishableKey, webhookSecret, mode] = await Promise.all([
      this.get(SETTING_KEYS.stripeSecretKey),
      this.get(SETTING_KEYS.stripePublishableKey),
      this.get(SETTING_KEYS.stripeWebhookSecret),
      this.get(SETTING_KEYS.stripeMode),
    ]);

    return {
      secretKey: secretKey || this.config.get<string>('stripe.secretKey') || '',
      publishableKey: publishableKey || this.config.get<string>('stripe.publishableKey') || '',
      webhookSecret: webhookSecret || this.config.get<string>('stripe.webhookSecret') || '',
      mode: mode || this.config.get<string>('stripe.mode') || 'test',
    };
  }
}
