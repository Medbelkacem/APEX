import { registerAs } from '@nestjs/config';

export const stripeConfig = registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_placeholder',
  mode: (process.env.STRIPE_MODE ?? 'test') as 'test' | 'live',
}));

export type StripeConfig = ReturnType<typeof stripeConfig>;
