import type { Metadata } from 'next';
import { Container } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'About',
};

/**
 * Intentionally minimal.
 *
 * Everything on this page is a factual claim about a real laboratory — years in
 * business, certifications, staffing, equipment — and none of it can be
 * invented by the development team. The sections below are left for the
 * laboratory to supply; an empty page is correct until then, a plausible-looking
 * one is not.
 */
export default function AboutPage() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold text-slate-900">About the laboratory</h1>
      </div>
    </Container>
  );
}
