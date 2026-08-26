/**
 * Regression tests for the marketing language the landing page is built from.
 *
 * Two kinds of thing are pinned here. The first is the Tailwind-ordering trap
 * that `ui/card.test.tsx` already documents: utilities of equal specificity
 * resolve by stylesheet order, not by their order in the class attribute, so a
 * component that emits a default unconditionally silently beats the caller who
 * tries to override it. `Icon` and `ctaClasses` both work around that, and both
 * failures would be invisible — a glyph that is quietly the wrong size, a
 * button that is quietly the wrong height.
 *
 * The second is the brand contract: every CTA is a pill, every tone is one of
 * the four brand colours, and the section rule is decoration that must stay out
 * of the accessibility tree.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Display, FeaturePill, Icon, IconTile, SectionRule, ctaClasses } from './marketing';

describe('ctaClasses', () => {
  it('is a pill in every tone, at every size', () => {
    for (const tone of ['pearl', 'navy', 'blue', 'onDark'] as const) {
      expect(ctaClasses(tone)).toContain('rounded-full');
      expect(ctaClasses(tone)).toContain('uppercase');
    }
  });

  it('paints each tone from the brand palette', () => {
    expect(ctaClasses('pearl')).toContain('bg-pearl');
    expect(ctaClasses('navy')).toContain('bg-navy-700');
    expect(ctaClasses('blue')).toContain('bg-blue-600');
    // The one washed tone: translucent white over whatever it is laid on.
    expect(ctaClasses('onDark')).toContain('bg-white/15');
  });

  it('emits exactly one height, so a caller cannot end up with two', () => {
    // The size is a parameter precisely because appending `h-12` to the string
    // would lose to an `h-14` already in it and quietly do nothing.
    const heights = (cls: string) => cls.split(' ').filter((c) => /^h-/.test(c));

    expect(heights(ctaClasses('blue', 'lg'))).toEqual(['h-14']);
    expect(heights(ctaClasses('blue', 'sm'))).toEqual(['h-12']);
  });

  it('defaults to the blue pill the design uses most', () => {
    expect(ctaClasses()).toBe(ctaClasses('blue', 'lg'));
  });
});

describe('Icon', () => {
  function icon(className?: string) {
    const { container } = render(
      <Icon className={className}>
        <path d="M0 0h24v24H0z" />
      </Icon>,
    );
    return container.querySelector('svg')!;
  }

  it('applies its own optical size when the caller asks for none', () => {
    expect(icon()).toHaveClass('h-7', 'w-7');
  });

  it('drops the default height when the caller sets one', () => {
    const el = icon('h-6 w-6');

    expect(el).toHaveClass('h-6', 'w-6');
    expect(el).not.toHaveClass('h-7');
    expect(el).not.toHaveClass('w-7');
  });

  it('drops only the axis the caller claimed', () => {
    const el = icon('h-9');

    expect(el).toHaveClass('h-9', 'w-7');
    expect(el).not.toHaveClass('h-7');
  });

  it('is decoration, never an image in the accessibility tree', () => {
    expect(icon()).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Display', () => {
  it('sets headlines in the brand display face', () => {
    render(<Display>Lab Reality</Display>);

    expect(screen.getByRole('heading', { name: 'Lab Reality' })).toHaveClass('font-display');
  });

  it('defaults to h2 and honours the level the caller asks for', () => {
    const { rerender } = render(<Display>Lab Reality</Display>);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();

    rerender(<Display as="h1">Stop Wasting Chair Time On</Display>);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('carries an id, so a section can be labelled by its own heading', () => {
    render(<Display id="problems-heading">Lab Reality</Display>);

    expect(screen.getByRole('heading')).toHaveAttribute('id', 'problems-heading');
  });

  it('keeps its leading marked important so a size class cannot override it', () => {
    // Tailwind's `text-*` scale carries a line-height of its own and emits the
    // responsive variants after every unprefixed utility.
    render(<Display className="text-3xl sm:text-5xl">Lab Reality</Display>);

    expect(screen.getByRole('heading')).toHaveClass('!leading-[1.331]', 'sm:text-5xl');
  });
});

describe('FeaturePill', () => {
  it('renders the title as a heading and the body beside it', () => {
    render(
      <FeaturePill
        title="Inconsistent Fit"
        body="Poor fit and remakes interrupt treatment flow and waste valuable chair time."
        icon={<path d="M0 0h24v24H0z" />}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Inconsistent Fit' })).toBeInTheDocument();
    expect(screen.getByText(/waste valuable chair time/)).toBeInTheDocument();
  });

  it('is a Super Blue card, as the design draws every feature', () => {
    const { container } = render(
      <FeaturePill title="Clear Pricing" body="Transparent rates." icon={<path d="M0 0h1v1H0z" />} />,
    );

    expect(container.firstChild).toHaveClass('bg-blue-600');
  });
});

describe('IconTile', () => {
  it('is the navy disc the design sets every glyph in', () => {
    const { container } = render(
      <IconTile>
        <span>x</span>
      </IconTile>,
    );

    expect(container.firstChild).toHaveClass('rounded-full', 'bg-navy-700');
  });
});

describe('SectionRule', () => {
  it('is decoration and stays out of the accessibility tree', () => {
    const { container } = render(<SectionRule />);

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstChild).toHaveClass('bg-blue-600');
  });
});
