/**
 * Stripe payment intents and webhook settlement.
 *
 * The Stripe SDK is mocked at the module boundary: `PaymentsService` builds a
 * client per call (`new Stripe(...)`) so that a super admin can rotate keys
 * without a redeploy, which means there is no injected provider to override.
 *
 * The webhook assertions are the point of this file. That endpoint is
 * `@Public()`, so the signature check is the *only* thing standing between the
 * internet and "mark this invoice paid" — and it has to run against the
 * untouched raw body, which a service-level test cannot exercise.
 */
import { INestApplication } from '@nestjs/common';
import { InvoiceStatus } from '@dental/shared-types';
import { Invoice } from '../src/database/entities/invoice.entity';
import { SETTING_KEYS, SettingsService } from '../src/modules/settings/settings.service';
import { createTestApp, TestApp } from './support/app';
import { truncateAll } from './support/database';
import { Fixtures } from './support/factories';
import { api, login, Session } from './support/http';

// Jest hoists `jest.mock` above the imports; referencing these from the factory
// is allowed because the names begin with `mock`, and the factory only runs
// when `stripe` is first required, by which point they are initialised.
const mockPaymentIntents = { create: jest.fn(), retrieve: jest.fn() };
const mockWebhooks = { constructEvent: jest.fn() };
const mockRefunds = { create: jest.fn() };

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    paymentIntents: mockPaymentIntents,
    webhooks: mockWebhooks,
    refunds: mockRefunds,
  })),
}));

const WEBHOOK_SECRET = 'whsec_test_secret';

describe('Payments (e2e)', () => {
  let ctx: TestApp;
  let app: INestApplication;
  let fixtures: Fixtures;
  let settings: SettingsService;

  let catalog: Awaited<ReturnType<Fixtures['catalog']>>;
  let dentist: Awaited<ReturnType<Fixtures['dentist']>>;
  let dentistSession: Session;
  let adminSession: Session;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    fixtures = new Fixtures(ctx.dataSource);
    settings = ctx.moduleRef.get(SettingsService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await truncateAll(ctx.dataSource);

    catalog = await fixtures.catalog();
    dentist = await fixtures.dentist();
    const admin = await fixtures.admin();
    dentistSession = await login(app, dentist.user.email);
    adminSession = await login(app, admin.email);

    // Without real-looking keys the service refuses to build a client at all.
    await settings.set(SETTING_KEYS.stripeSecretKey, 'sk_test_realistic');
    await settings.set(SETTING_KEYS.stripePublishableKey, 'pk_test_realistic');
    await settings.set(SETTING_KEYS.stripeWebhookSecret, WEBHOOK_SECRET);
  });

  /** Creates an invoice and drives it to the requested status. */
  async function invoice(status: 'draft' | 'issued' | 'paid' = 'issued'): Promise<Invoice> {
    const created = await api(app)
      .post('/api/cases')
      .set('Cookie', dentistSession.cookie)
      .send({ caseTypeId: catalog.caseType.id, patientReference: 'PT-PAY' });

    const generated = await api(app)
      .post('/api/invoices/generate')
      .set('Cookie', adminSession.cookie)
      .send({ caseId: created.body.id });

    if (status !== 'draft') {
      await api(app)
        .post(`/api/invoices/${generated.body.id}/issue`)
        .set('Cookie', adminSession.cookie);
    }
    if (status === 'paid') {
      await api(app)
        .post(`/api/invoices/${generated.body.id}/mark-paid`)
        .set('Cookie', adminSession.cookie);
    }

    return ctx.dataSource.getRepository(Invoice).findOneByOrFail({ id: generated.body.id });
  }

  const reload = (id: string) =>
    ctx.dataSource.getRepository(Invoice).findOneByOrFail({ id });

  /**
   * A `payment_intent.succeeded` event that collected exactly what the invoice
   * asks for. Settlement checks `amount_received` against the invoice total, so
   * an event built without one is not a payment the service will apply — the
   * amount belongs in the fixture, as it does in a real Stripe payload.
   */
  function succeeded(
    id: string,
    inv: Invoice,
    overrides: { metadata?: Record<string, string>; amountReceived?: number; currency?: string } = {},
  ) {
    return {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id,
          metadata: overrides.metadata ?? { invoiceId: inv.id },
          amount_received: overrides.amountReceived ?? Math.round(Number(inv.total) * 100),
          currency: overrides.currency ?? inv.currency.toLowerCase(),
        },
      },
    };
  }

  describe('POST /api/invoices/:id/payment-intent', () => {
    it('creates an intent for the invoice amount in minor units', async () => {
      const inv = await invoice('issued');
      mockPaymentIntents.create.mockResolvedValue({
        id: 'pi_test_1',
        client_secret: 'pi_test_1_secret',
      });

      const res = await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        clientSecret: 'pi_test_1_secret',
        amount: '100.00',
        currency: 'USD',
      });
      expect(mockPaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10_000, currency: 'usd' }),
      );
    });

    it('carries the invoice id in metadata so the webhook can resolve it', async () => {
      const inv = await invoice('issued');
      mockPaymentIntents.create.mockResolvedValue({ id: 'pi_x', client_secret: 'cs_x' });

      await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      expect(mockPaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ invoiceId: inv.id }),
        }),
      );
    });

    it('stores the intent id against the invoice', async () => {
      const inv = await invoice('issued');
      mockPaymentIntents.create.mockResolvedValue({ id: 'pi_stored', client_secret: 'cs' });

      await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      expect((await reload(inv.id)).stripePaymentIntentId).toBe('pi_stored');
    });

    it('reuses a still-payable intent rather than stranding a second authorisation', async () => {
      const inv = await invoice('issued');
      mockPaymentIntents.create.mockResolvedValue({ id: 'pi_first', client_secret: 'cs_first' });
      await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      mockPaymentIntents.retrieve.mockResolvedValue({
        id: 'pi_first',
        client_secret: 'cs_first',
        amount: 10_000,
        status: 'requires_payment_method',
      });

      const res = await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      expect(res.body.clientSecret).toBe('cs_first');
      expect(mockPaymentIntents.create).toHaveBeenCalledTimes(1);
    });

    it('creates a fresh intent when the stored one no longer matches the amount', async () => {
      const inv = await invoice('issued');
      mockPaymentIntents.create.mockResolvedValue({ id: 'pi_first', client_secret: 'cs_first' });
      await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      mockPaymentIntents.retrieve.mockResolvedValue({
        id: 'pi_first',
        client_secret: 'cs_first',
        amount: 999, // invoice is 10,000 minor units
        status: 'requires_payment_method',
      });
      mockPaymentIntents.create.mockResolvedValue({ id: 'pi_second', client_secret: 'cs_second' });

      const res = await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      expect(res.body.clientSecret).toBe('cs_second');
      expect(mockPaymentIntents.create).toHaveBeenCalledTimes(2);
    });

    it('refuses an invoice that is already paid', async () => {
      const inv = await invoice('paid');

      const res = await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(400);
      expect(mockPaymentIntents.create).not.toHaveBeenCalled();
    });

    it('hides an unissued draft from the dentist entirely', async () => {
      const inv = await invoice('draft');

      const res = await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      // 404 rather than 400: scoping excludes drafts, so the invoice is not
      // merely unpayable to a dentist — its existence is never confirmed.
      expect(res.status).toBe(404);
      expect(mockPaymentIntents.create).not.toHaveBeenCalled();
    });

    it('refuses a draft for an admin, who can see it but must issue it first', async () => {
      const inv = await invoice('draft');

      const res = await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', adminSession.cookie);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/issued/i);
    });

    it("refuses another dentist's invoice", async () => {
      const inv = await invoice('issued');
      const other = await fixtures.dentist();
      const otherSession = await login(app, other.user.email);

      const res = await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', otherSession.cookie);

      expect(res.status).toBe(404);
      expect(mockPaymentIntents.create).not.toHaveBeenCalled();
    });

    it('reports clearly when Stripe has not been configured', async () => {
      await settings.set(SETTING_KEYS.stripeSecretKey, null);
      const inv = await invoice('issued');

      const res = await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not configured/i);
    });
  });

  describe('POST /api/payments/webhook', () => {
    const send = (body: object, signature?: string) => {
      const req = api(app).post('/api/payments/webhook').send(body);
      return signature ? req.set('stripe-signature', signature) : req;
    };

    it('rejects a payload with no signature header', async () => {
      const res = await send({ type: 'payment_intent.succeeded' });

      expect(res.status).toBe(400);
      expect(mockWebhooks.constructEvent).not.toHaveBeenCalled();
    });

    it('rejects a payload whose signature does not verify', async () => {
      mockWebhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      const res = await send({ type: 'payment_intent.succeeded' }, 'sig_forged');

      expect(res.status).toBe(400);
    });

    it('verifies against the raw body, not the parsed one', async () => {
      const inv = await invoice('issued');
      const payload = { type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } };
      mockWebhooks.constructEvent.mockReturnValue(succeeded('pi_1', inv));

      await send(payload, 'sig_valid');

      const [rawBody, signature, secret] = mockWebhooks.constructEvent.mock.calls[0];
      expect(Buffer.isBuffer(rawBody)).toBe(true);
      // Byte-for-byte what the client sent — re-serialising would break the HMAC.
      expect(JSON.parse((rawBody as Buffer).toString())).toEqual(payload);
      expect(signature).toBe('sig_valid');
      expect(secret).toBe(WEBHOOK_SECRET);
    });

    it('settles the invoice named in the intent metadata', async () => {
      const inv = await invoice('issued');
      mockWebhooks.constructEvent.mockReturnValue(succeeded('pi_ok', inv));

      const res = await send({}, 'sig_valid');

      expect(res.status).toBe(200);
      const stored = await reload(inv.id);
      expect(stored.status).toBe(InvoiceStatus.PAID);
      expect(stored.paidAt).not.toBeNull();
      expect(stored.stripePaymentIntentId).toBe('pi_ok');
    });

    it('falls back to the stored intent id when metadata is absent', async () => {
      const inv = await invoice('issued');
      mockPaymentIntents.create.mockResolvedValue({ id: 'pi_linked', client_secret: 'cs' });
      await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      mockWebhooks.constructEvent.mockReturnValue(succeeded('pi_linked', inv, { metadata: {} }));

      await send({}, 'sig_valid');

      expect((await reload(inv.id)).status).toBe(InvoiceStatus.PAID);
    });

    it('tolerates a redelivered success event', async () => {
      const inv = await invoice('issued');
      mockWebhooks.constructEvent.mockReturnValue(succeeded('pi_ok', inv));

      await send({}, 'sig_valid');
      const firstPaidAt = (await reload(inv.id)).paidAt;

      const replay = await send({}, 'sig_valid');

      expect(replay.status).toBe(200);
      const stored = await reload(inv.id);
      expect(stored.status).toBe(InvoiceStatus.PAID);
      // The original settlement time must not be overwritten.
      expect(stored.paidAt).toEqual(firstPaidAt);
    });

    it('refuses to settle an intent that collected less than the invoice total', async () => {
      const inv = await invoice('issued');
      // A genuine, correctly signed intent for one cent, carrying this
      // invoice's id in its metadata. Trusting the metadata alone would close a
      // $100 invoice for $0.01.
      mockWebhooks.constructEvent.mockReturnValue(
        succeeded('pi_short', inv, { amountReceived: 1 }),
      );

      const res = await send({}, 'sig_valid');

      expect(res.status).toBe(200);
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.ISSUED);
    });

    it('refuses to settle an intent that reports no amount at all', async () => {
      const inv = await invoice('issued');
      mockWebhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_silent', metadata: { invoiceId: inv.id } } },
      });

      const res = await send({}, 'sig_valid');

      // Unverifiable is not the same as verified: an amount that cannot be
      // checked must not settle an invoice.
      expect(res.status).toBe(200);
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.ISSUED);
    });

    it('refuses to settle an intent denominated in another currency', async () => {
      const inv = await invoice('issued');
      // 10,000 minor units clears the amount check, but 10,000 yen is not $100.
      mockWebhooks.constructEvent.mockReturnValue(succeeded('pi_jpy', inv, { currency: 'jpy' }));

      const res = await send({}, 'sig_valid');

      expect(res.status).toBe(200);
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.ISSUED);
    });

    it('acknowledges a failed payment without changing the invoice', async () => {
      const inv = await invoice('issued');
      mockWebhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_fail', metadata: { invoiceId: inv.id } } },
      });

      const res = await send({}, 'sig_valid');

      expect(res.status).toBe(200);
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.ISSUED);
    });

    it('marks a refunded charge on the invoice', async () => {
      const inv = await invoice('issued');
      mockPaymentIntents.create.mockResolvedValue({ id: 'pi_ref', client_secret: 'cs' });
      await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);

      mockWebhooks.constructEvent.mockReturnValue(succeeded('pi_ref', inv));
      await send({}, 'sig_valid');

      mockWebhooks.constructEvent.mockReturnValue({
        type: 'charge.refunded',
        data: { object: { id: 'ch_1', payment_intent: 'pi_ref' } },
      });
      const res = await send({}, 'sig_valid');

      expect(res.status).toBe(200);
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.REFUNDED);
    });

    it('ignores an event type it does not handle', async () => {
      mockWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: {} },
      });

      const res = await send({}, 'sig_valid');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
    });

    it('acknowledges a success event that matches no invoice', async () => {
      mockWebhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_orphan', metadata: {} } },
      });

      const res = await send({}, 'sig_valid');

      // Returning non-200 would make Stripe retry an event that can never apply.
      expect(res.status).toBe(200);
    });

    it('needs no authentication, since the signature is the credential', async () => {
      mockWebhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: {} },
      });

      const res = await send({}, 'sig_valid');

      expect(res.status).not.toBe(401);
    });
  });

  describe('POST /api/invoices/:id/refund', () => {
    /** An invoice settled through Stripe, so it has an intent to refund against. */
    async function paidThroughStripe(intentId = 'pi_paid'): Promise<Invoice> {
      const inv = await invoice('issued');
      mockPaymentIntents.create.mockResolvedValue({ id: intentId, client_secret: 'cs' });
      await api(app)
        .post(`/api/invoices/${inv.id}/payment-intent`)
        .set('Cookie', dentistSession.cookie);
      await api(app).post(`/api/invoices/${inv.id}/mark-paid`).set('Cookie', adminSession.cookie);
      return reload(inv.id);
    }

    const refund = (id: string) =>
      api(app).post(`/api/invoices/${id}/refund`).set('Cookie', adminSession.cookie);

    it('refunds a paid invoice through Stripe', async () => {
      const inv = await paidThroughStripe();
      mockRefunds.create.mockResolvedValue({ id: 're_1' });

      const res = await refund(inv.id);

      expect(res.status).toBe(201);
      expect(mockRefunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_paid' }),
        expect.objectContaining({ idempotencyKey: expect.any(String) }),
      );
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.REFUNDED);
    });

    it('does not issue a second Stripe refund when refunded twice', async () => {
      const inv = await paidThroughStripe();
      mockRefunds.create.mockResolvedValue({ id: 're_1' });

      await refund(inv.id);
      const second = await refund(inv.id);

      // The money leaves the lab's account at Stripe, so the guard has to stop
      // the call — rejecting only afterwards would already have paid twice.
      expect(second.status).toBe(400);
      expect(mockRefunds.create).toHaveBeenCalledTimes(1);
    });

    it('leaves the invoice paid when Stripe rejects the refund', async () => {
      const inv = await paidThroughStripe();
      mockRefunds.create.mockRejectedValue(new Error('charge already refunded'));

      const res = await refund(inv.id);

      expect(res.status).toBeGreaterThanOrEqual(400);
      // No refund happened, so the invoice must not be left claiming one did.
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.PAID);
    });

    it('refuses to refund an invoice that was never paid', async () => {
      const inv = await invoice('issued');

      const res = await refund(inv.id);

      expect(res.status).toBe(400);
      expect(mockRefunds.create).not.toHaveBeenCalled();
    });

    it('does not un-refund an invoice when the original success event is redelivered', async () => {
      const inv = await paidThroughStripe('pi_replay');
      mockRefunds.create.mockResolvedValue({ id: 're_1' });
      await refund(inv.id);
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.REFUNDED);

      // Stripe redelivers `succeeded` for days. The event that first settled
      // this invoice is still in flight when the refund is issued.
      mockWebhooks.constructEvent.mockReturnValue(succeeded('pi_replay', inv));
      const res = await api(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'sig_valid')
        .send({});

      // 200 because retrying cannot help — but the refund stands.
      expect(res.status).toBe(200);
      expect((await reload(inv.id)).status).toBe(InvoiceStatus.REFUNDED);
    });
  });
});
