import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { AuthenticatedUser, InvoiceStatus } from '@dental/shared-types';
import { InvoicesService } from '../invoices/invoices.service';
import { SettingsService } from '../settings/settings.service';

export interface PaymentIntentResponse {
  clientSecret: string;
  publishableKey: string;
  amount: string;
  currency: string;
}

/**
 * Stripe integration for invoice settlement. Credentials are resolved at call
 * time (super admins can rotate them from Platform Settings without a redeploy),
 * so the client is built per request rather than injected once at boot.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly invoices: InvoicesService,
    private readonly settings: SettingsService,
  ) {}

  private async client(): Promise<{ stripe: Stripe; publishableKey: string; webhookSecret: string }> {
    const config = await this.settings.stripeConfig();
    if (!config.secretKey || config.secretKey.includes('placeholder')) {
      throw new BadRequestException(
        'Stripe is not configured — a super admin must set the API keys in Platform Settings',
      );
    }
    return {
      stripe: new Stripe(config.secretKey, { apiVersion: '2024-06-20' }),
      publishableKey: config.publishableKey,
      webhookSecret: config.webhookSecret,
    };
  }

  /**
   * Create (or reuse) a Payment Intent for an invoice. Reusing the existing
   * intent means a dentist who reloads the payment page does not strand a
   * second authorisation on their card.
   */
  async createPaymentIntent(
    invoiceId: string,
    user: AuthenticatedUser,
  ): Promise<PaymentIntentResponse> {
    const invoice = await this.invoices.findScoped(invoiceId, user);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('This invoice has already been paid');
    }
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Only an issued invoice can be paid');
    }

    const { stripe, publishableKey } = await this.client();
    const amountInMinorUnits = Math.round(Number(invoice.total) * 100);
    if (amountInMinorUnits <= 0) {
      throw new BadRequestException('This invoice has no outstanding amount');
    }

    if (invoice.stripePaymentIntentId) {
      const existing = await stripe.paymentIntents
        .retrieve(invoice.stripePaymentIntentId)
        .catch(() => null);
      // Reuse only while the intent is still payable and for the same amount.
      if (
        existing &&
        existing.client_secret &&
        existing.amount === amountInMinorUnits &&
        ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
          existing.status,
        )
      ) {
        return {
          clientSecret: existing.client_secret,
          publishableKey,
          amount: invoice.total,
          currency: invoice.currency,
        };
      }
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountInMinorUnits,
      currency: invoice.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      description: `Invoice ${invoice.number}`,
      // The webhook is the source of truth for settlement, so carry the ids.
      metadata: { invoiceId: invoice.id, invoiceNumber: invoice.number },
    });

    await this.invoices.attachPaymentIntent(invoice.id, intent.id);

    return {
      clientSecret: intent.client_secret!,
      publishableKey,
      amount: invoice.total,
      currency: invoice.currency,
    };
  }

  /**
   * Verify and apply a Stripe webhook. The signature check is what makes this
   * endpoint safe to expose unauthenticated — it must run against the raw body.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean }> {
    const { stripe, webhookSecret } = await this.client();
    if (!webhookSecret || webhookSecret.includes('placeholder')) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      // Never process an unverified payload.
      throw new BadRequestException(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await this.settleFromIntent(intent);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        this.logger.warn(
          `Payment failed for invoice ${intent.metadata?.invoiceNumber ?? intent.id}: ${
            intent.last_payment_error?.message ?? 'no reason given'
          }`,
        );
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const intentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (intentId) {
          const invoice = await this.invoices.findByPaymentIntent(intentId);
          if (invoice) await this.invoices.markRefunded(invoice.id);
        }
        break;
      }
      default:
        this.logger.debug(`Ignoring unhandled Stripe event ${event.type}`);
    }

    return { received: true };
  }

  /** Resolve the invoice behind a succeeded intent and mark it paid. */
  private async settleFromIntent(intent: Stripe.PaymentIntent): Promise<void> {
    const invoiceId = intent.metadata?.invoiceId;
    const invoice = invoiceId
      ? await this.invoices.findByIdOrFail(invoiceId).catch(() => null)
      : await this.invoices.findByPaymentIntent(intent.id);

    if (!invoice) {
      this.logger.error(`Stripe intent ${intent.id} succeeded but no invoice matched it`);
      return;
    }
    // markPaid is idempotent, so a redelivered webhook is harmless.
    await this.invoices.markPaid(invoice.id, { stripePaymentIntentId: intent.id });
    this.logger.log(`Invoice ${invoice.number} settled via Stripe intent ${intent.id}`);
  }

  /** Issue a refund through Stripe, then reflect it on the invoice. */
  async refund(invoiceId: string): Promise<void> {
    const invoice = await this.invoices.findByIdOrFail(invoiceId);
    if (!invoice.stripePaymentIntentId) {
      // Paid offline — there is nothing to refund at Stripe.
      await this.invoices.markRefunded(invoice.id);
      return;
    }
    const { stripe } = await this.client();
    await stripe.refunds.create({ payment_intent: invoice.stripePaymentIntentId });
    // The charge.refunded webhook also fires; markRefunded tolerates both paths.
    await this.invoices.markRefunded(invoice.id);
  }
}
