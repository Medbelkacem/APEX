'use client';

import { FormEvent, useMemo, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/data-states';
import { invoicesApi } from '@/lib/api/invoices';
import { formatMoney } from '@/lib/utils/format';

/** Cache Stripe.js per publishable key — loading it twice is wasteful. */
const stripeCache = new Map<string, Promise<Stripe | null>>();
function stripeFor(publishableKey: string): Promise<Stripe | null> {
  let promise = stripeCache.get(publishableKey);
  if (!promise) {
    promise = loadStripe(publishableKey);
    stripeCache.set(publishableKey, promise);
  }
  return promise;
}

interface IntentState {
  clientSecret: string;
  publishableKey: string;
  amount: string;
  currency: string;
}

/** The card form itself — must live inside <Elements>. */
function CheckoutForm({
  intent,
  onPaid,
}: {
  intent: IntentState;
  onPaid: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(undefined);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Stay on the page for cards that don't need a redirect; Stripe only
      // navigates away for methods that genuinely require it (3DS, wallets).
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message ?? 'The payment could not be completed');
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      // The webhook is what actually marks the invoice paid; this just moves
      // the UI on and lets the page re-fetch the authoritative status.
      onPaid();
      return;
    }

    setError('Payment is still processing — refresh in a moment to see the result.');
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={!stripe || submitting} className="w-full">
        {submitting && <Spinner className="mr-2" />}
        {submitting ? 'Processing…' : `Pay ${formatMoney(intent.amount, intent.currency)}`}
      </Button>
      <p className="text-center text-xs text-slate-500">
        Payments are processed securely by Stripe. Card details never reach our servers.
      </p>
    </form>
  );
}

export function InvoicePayment({
  invoiceId,
  onPaid,
}: {
  invoiceId: string;
  onPaid: () => void;
}) {
  const [intent, setIntent] = useState<IntentState>();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();

  const stripePromise = useMemo(
    () => (intent ? stripeFor(intent.publishableKey) : null),
    [intent],
  );

  async function start() {
    setStarting(true);
    setError(undefined);
    try {
      setIntent(await invoicesApi.createPaymentIntent(invoiceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment');
    } finally {
      setStarting(false);
    }
  }

  if (!intent) {
    return (
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <Button onClick={start} disabled={starting} className="w-full">
          {starting && <Spinner className="mr-2" />}
          Pay this invoice online
        </Button>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: intent.clientSecret,
        appearance: { theme: 'stripe', variables: { colorPrimary: '#0049cc' } },
      }}
    >
      <CheckoutForm intent={intent} onPaid={onPaid} />
    </Elements>
  );
}
