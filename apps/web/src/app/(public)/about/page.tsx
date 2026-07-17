import type { Metadata } from 'next';
import { Container, Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'About',
  description: 'Our dental laboratory — background, team, certifications, and equipment.',
};

export default function AboutPage() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold text-slate-900">About the laboratory</h1>
        <p className="mt-6 text-lg text-slate-600">
          We are a full-service dental laboratory combining experienced technicians with a fully
          digital workflow. Our mission is to make high-quality restorations fast, predictable, and
          easy to order for the practices we serve.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            ['15+ years', 'Serving dental practices'],
            ['ISO-aligned', 'Quality processes'],
            ['CAD/CAM', 'Milling & 3D printing'],
          ].map(([stat, label]) => (
            <Card key={label}>
              <div className="text-2xl font-bold text-brand-700">{stat}</div>
              <div className="mt-1 text-sm text-slate-500">{label}</div>
            </Card>
          ))}
        </div>

        <h2 className="mt-14 text-2xl font-semibold text-slate-900">Our team</h2>
        <p className="mt-4 text-slate-600">
          Certified dental technicians specializing in fixed prosthetics, implants, and removable
          restorations, supported by digital designers and a dedicated case-coordination team.
        </p>

        <h2 className="mt-10 text-2xl font-semibold text-slate-900">Equipment</h2>
        <p className="mt-4 text-slate-600">
          Intraoral-scan-ready workflow, high-precision milling machines, and calibrated 3D printers,
          with a color-managed finishing studio for natural aesthetics.
        </p>
      </div>
    </Container>
  );
}
