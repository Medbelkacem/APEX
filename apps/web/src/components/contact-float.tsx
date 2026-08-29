import { Icon } from '@/components/marketing';

/**
 * The floating contact button the design pins to the bottom-right of every
 * marketing screen.
 *
 * Direct access to the team is the brand's stated promise, so the button links
 * to whichever channel the laboratory has configured — WhatsApp if there is a
 * number, otherwise a plain tel: link. With neither set nothing is rendered: a
 * call button that dials nobody is worse than no button at all.
 */
export function ContactFloat() {
  const whatsapp = process.env.LAB_WHATSAPP?.replace(/[^\d]/g, '');
  const phone = process.env.LAB_PHONE?.trim();

  const target = whatsapp
    ? { href: `https://wa.me/${whatsapp}`, label: 'Message the lab on WhatsApp', external: true }
    : phone
      ? { href: `tel:${phone.replace(/\s+/g, '')}`, label: 'Call the lab', external: false }
      : null;

  if (!target) return null;

  return (
    <a
      href={target.href}
      aria-label={target.label}
      {...(target.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="fixed bottom-6 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-xl shadow-navy-900/25 transition-transform hover:scale-105 sm:bottom-8 sm:right-8 sm:h-16 sm:w-16"
    >
      <Icon className="h-7 w-7">
        <path d="M20 15.5v2.4a1.6 1.6 0 0 1-1.8 1.6 15.6 15.6 0 0 1-6.8-2.4 15.4 15.4 0 0 1-4.7-4.7A15.6 15.6 0 0 1 4.3 5.6 1.6 1.6 0 0 1 5.9 3.9h2.4a1.6 1.6 0 0 1 1.6 1.4c.1.8.3 1.5.6 2.2a1.6 1.6 0 0 1-.4 1.7l-1 1a12.4 12.4 0 0 0 4.7 4.7l1-1a1.6 1.6 0 0 1 1.7-.4c.7.3 1.4.5 2.2.6a1.6 1.6 0 0 1 1.3 1.4Z" />
      </Icon>
    </a>
  );
}
