import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Dental case types we offer: crowns, bridges, implants, veneers, dentures, aligners.',
};

const SERVICES = [
  {
    name: 'Crowns',
    description: 'Single-unit ceramic and zirconia crowns with natural aesthetics and precise fit.',
  },
  {
    name: 'Bridges',
    description: 'Multi-unit fixed bridges engineered for strength and long-term durability.',
  },
  {
    name: 'Implants',
    description: 'Implant-supported crowns, bridges, and custom abutments from major systems.',
  },
  {
    name: 'Veneers',
    description: 'Thin porcelain and composite veneers designed for a bright, natural smile.',
  },
  {
    name: 'Dentures',
    description: 'Full and partial removable dentures with a comfortable, accurate base.',
  },
  {
    name: 'Aligners',
    description: 'Clear orthodontic aligners produced from your digital impressions.',
  },
];

export default function ServicesPage() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-slate-900">Our services</h1>
        <p className="mt-4 text-lg text-slate-600">
          A complete range of restorative and orthodontic case types, all orderable through the
          portal.
        </p>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => (
          <Card key={s.name}>
            <h2 className="text-lg font-semibold text-slate-900">{s.name}</h2>
            <p className="mt-2 text-sm text-slate-600">{s.description}</p>
          </Card>
        ))}
      </div>

      <div className="mt-14 text-center">
        <Link href="/contact" className={buttonClasses('primary', 'lg')}>
          Request pricing
        </Link>
      </div>
    </Container>
  );
}
