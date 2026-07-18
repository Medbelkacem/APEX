import Link from 'next/link';
import { Container } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo className="text-brand-700" />
          <p className="mt-3 max-w-xs text-sm text-slate-500">
            Precision dental restorations with a fully digital case workflow.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link href="/about" className="hover:text-brand-700">
                About
              </Link>
            </li>
            <li>
              <Link href="/services" className="hover:text-brand-700">
                Services
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-brand-700">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">For dentists</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link href="/how-to-send-a-case" className="hover:text-brand-700">
                How to send a case
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-brand-700">
                Portal login
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Legal</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link href="/privacy" className="hover:text-brand-700">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-brand-700">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        © {year} Dental Lab. All rights reserved.
      </div>
    </footer>
  );
}
