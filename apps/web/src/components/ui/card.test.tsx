/**
 * Regression tests for Card's conditional defaults.
 *
 * Tailwind resolves utilities of equal specificity by stylesheet order, not by
 * their order in the class attribute, so a hard-coded `bg-white` default beats
 * a caller's `bg-brand-700` no matter which is written last. That produced an
 * invisible white-on-white CTA on the homepage. Card now emits each default
 * only when the caller has not claimed that group — these tests pin that down,
 * because the failure mode is silent and visual.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, Container } from './card';

function card(className?: string) {
  render(
    <Card className={className} data-testid="card">
      content
    </Card>,
  );
  return screen.getByTestId('card');
}

describe('Card', () => {
  it('applies its defaults when the caller passes nothing', () => {
    const el = card();

    expect(el).toHaveClass('bg-white', 'p-6', 'border-slate-200', 'rounded-xl', 'shadow-sm');
  });

  it('drops the default background when the caller sets one', () => {
    const el = card('bg-brand-700');

    expect(el).toHaveClass('bg-brand-700');
    expect(el).not.toHaveClass('bg-white');
  });

  it('drops the default padding when the caller sets one', () => {
    const el = card('p-0');

    expect(el).toHaveClass('p-0');
    expect(el).not.toHaveClass('p-6');
  });

  it('drops the default border colour when the caller sets one', () => {
    const el = card('border-amber-300');

    expect(el).toHaveClass('border-amber-300');
    expect(el).not.toHaveClass('border-slate-200');
  });

  it('overrides only the group the caller claimed', () => {
    const el = card('bg-brand-700');

    // Padding and border were not claimed, so their defaults must survive.
    expect(el).toHaveClass('p-6', 'border-slate-200');
  });

  it('treats a hover variant as decoration, not as an override', () => {
    const el = card('hover:bg-slate-50');

    // `hover:bg-…` only applies on hover, so the base background is still needed.
    expect(el).toHaveClass('bg-white', 'hover:bg-slate-50');
  });

  it('recognises an override that is not the first class listed', () => {
    const el = card('shadow-lg bg-brand-700');

    expect(el).not.toHaveClass('bg-white');
  });

  it('does not mistake an unrelated class that merely starts with the prefix', () => {
    // `px-4` sets horizontal padding only; the all-sides default still applies.
    const el = card('px-4');

    expect(el).toHaveClass('p-6', 'px-4');
  });

  it('keeps the structural classes that are never conditional', () => {
    const el = card('bg-brand-700 p-0 border-amber-300');

    expect(el).toHaveClass('rounded-xl', 'border', 'shadow-sm');
  });

  it('forwards arbitrary DOM props', () => {
    render(
      <Card id="panel" role="region" aria-label="Summary">
        content
      </Card>,
    );

    const el = screen.getByRole('region', { name: 'Summary' });
    expect(el).toHaveAttribute('id', 'panel');
  });
});

describe('Container', () => {
  it('applies the shared page gutters', () => {
    render(<Container data-testid="container">content</Container>);

    expect(screen.getByTestId('container')).toHaveClass('mx-auto', 'w-full', 'max-w-6xl');
  });

  it('appends caller classes', () => {
    render(
      <Container className="py-12" data-testid="container">
        content
      </Container>,
    );

    expect(screen.getByTestId('container')).toHaveClass('py-12', 'max-w-6xl');
  });
});
