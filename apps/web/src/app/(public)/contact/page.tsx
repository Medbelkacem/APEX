import type { Metadata } from 'next';
import { Container, Card } from '@/components/ui/card';
import { ContactForm } from '@/components/forms/contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with our dental laboratory — address, phone, email, and contact form.',
};

export default function ContactPage() {
  return (
    <Container className="py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Contact us</h1>
          <p className="mt-4 text-lg text-slate-600">
            Questions about partnering with the lab or sending a case? Send us a message and our team
            will respond promptly.
          </p>

          <dl className="mt-10 space-y-6 text-sm">
            <div>
              <dt className="font-semibold text-slate-900">Address</dt>
              <dd className="mt-1 text-slate-600">123 Laboratory Way, Suite 200, Your City</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Phone</dt>
              <dd className="mt-1 text-slate-600">+1 (555) 010-2030</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Email</dt>
              <dd className="mt-1 text-slate-600">hello@dental-lab.test</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Hours</dt>
              <dd className="mt-1 text-slate-600">Mon–Fri, 8:00–18:00</dd>
            </div>
          </dl>
        </div>

        <Card>
          <ContactForm />
        </Card>
      </div>
    </Container>
  );
}
