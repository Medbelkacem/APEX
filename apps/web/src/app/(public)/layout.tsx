import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { ContactFloat } from '@/components/contact-float';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/*
       * The header is fixed so the dark band each page opens with runs behind
       * it, as the design shows. That takes it out of flow, so the clearance it
       * would have occupied belongs to the opening section of every page.
       */}
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <ContactFloat />
    </div>
  );
}
