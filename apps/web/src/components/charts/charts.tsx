'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Lightweight inline-SVG charts. No charting dependency: every form used by the
 * dashboard is a handful of paths, and hand-rolling them keeps the bundle small
 * and the markup accessible.
 *
 * Colour policy (see the data-viz method):
 *  - Single-series charts use ONE sequential hue — colour carries magnitude,
 *    not identity, so no legend is needed and the title names the series.
 *  - The only multi-colour chart is the workflow-status breakdown, which uses
 *    each status's own configured colour and always shows its label, so identity
 *    never rests on colour alone.
 */

/** Sequential hue for magnitude — the brand teal, dark enough for 3:1 contrast. */
const SEQ = '#0f766e';
const SEQ_SOFT = 'rgba(15, 118, 110, 0.14)';
const GRID = '#e2e8f0';
const AXIS_TEXT = '#64748b';

export interface Point {
  period: string;
  value: number;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / magnitude) * magnitude;
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Width of the element the returned ref is attached to, in CSS pixels.
 *
 * A fixed viewBox scales its own text with the container: the 10px axis labels
 * below would render at roughly 4px on a phone, which is unreadable. Measuring
 * instead lets the chart use a 1:1 viewBox, so a font size means what it says at
 * every width. The fallback covers the first paint and server rendering.
 */
function useMeasuredWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export function ChartFrame({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function NoData({ label = 'No data in this period' }: { label?: string }) {
  return <div className="grid h-48 place-items-center text-sm text-slate-400">{label}</div>;
}

/**
 * Single-series area + line over time, with a hover crosshair and tooltip.
 * One series, so no legend — the frame title names it.
 */
export function TimeSeriesChart({
  data,
  valueLabel,
  formatValue = (v) => String(v),
}: {
  data: Point[];
  valueLabel: string;
  formatValue?: (value: number) => string;
}) {
  // The ref lives on this wrapper rather than inside the branch below, so the
  // width is already known by the time data arrives and the plot is drawn.
  const [ref, width] = useMeasuredWidth<HTMLDivElement>(720);

  return (
    <div className="relative" ref={ref}>
      {data.length === 0 ? (
        <NoData />
      ) : (
        <Series data={data} valueLabel={valueLabel} formatValue={formatValue} width={width} />
      )}
    </div>
  );
}

function Series({
  data,
  valueLabel,
  formatValue,
  width,
}: {
  data: Point[];
  valueLabel: string;
  formatValue: (value: number) => string;
  width: number;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  // One user unit = one CSS pixel, so the type sizes below hold at any width.
  const W = Math.max(width, 240);
  // A phone gets a shorter plot; the labels deliberately do not shrink with it.
  const H = W < 480 ? 176 : 220;
  const PAD = { top: 12, right: 12, bottom: 28, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = niceMax(Math.max(...data.map((d) => d.value)));
  // A single point has no span to divide by; pin it to the middle of the plot.
  const xFor = (i: number) =>
    PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yFor = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.value)}`).join(' ');
  const area = `${line} L ${xFor(data.length - 1)} ${PAD.top + plotH} L ${xFor(0)} ${PAD.top + plotH} Z`;

  const ticks = [0, 0.5, 1].map((t) => ({ value: max * t, y: yFor(max * t) }));
  const active = hover === null ? null : data[hover];

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="w-full"
        role="img"
        aria-label={`${valueLabel} over time`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SEQ} stopOpacity="0.22" />
            <stop offset="100%" stopColor={SEQ} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Recessive gridlines + value axis */}
        {ticks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={tick.y}
              y2={tick.y}
              stroke={GRID}
              strokeWidth="1"
            />
            <text x={PAD.left - 8} y={tick.y + 4} textAnchor="end" fontSize="11" fill={AXIS_TEXT}>
              {formatValue(tick.value)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={SEQ}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair for the hovered column */}
        {active && (
          <line
            x1={xFor(hover!)}
            x2={xFor(hover!)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke={SEQ}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {data.map((d, i) => (
          <g key={d.period}>
            {/* Hit target is far wider than the mark so hovering is forgiving. */}
            <rect
              x={xFor(i) - plotW / Math.max(data.length, 1) / 2}
              y={PAD.top}
              width={Math.max(plotW / Math.max(data.length, 1), 12)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {(hover === i || data.length <= 12) && (
              <circle
                cx={xFor(i)}
                cy={yFor(d.value)}
                r={hover === i ? 5 : 3.5}
                fill={SEQ}
                stroke="#ffffff"
                strokeWidth="2"
              />
            )}
          </g>
        ))}

        {/* Only first/middle/last date labels, to avoid collisions */}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1]
          .filter((i, idx, arr) => i >= 0 && arr.indexOf(i) === idx)
          .map((i) => (
            <text
              key={i}
              x={xFor(i)}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill={AXIS_TEXT}
            >
              {shortDate(data[i].period)}
            </text>
          ))}
      </svg>

      {active && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
          <div className="font-medium text-slate-900">{shortDate(active.period)}</div>
          <div className="text-slate-600">
            {valueLabel}: <span className="font-semibold">{formatValue(active.value)}</span>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Horizontal magnitude bars. Sequential single hue by default; pass per-row
 * colours only where they carry domain meaning (workflow statuses), in which
 * case the row label supplies the non-colour encoding.
 */
export function BarList({
  rows,
  formatValue = (v) => String(v),
  emptyLabel,
}: {
  rows: Array<{ label: string; value: number; color?: string }>;
  formatValue?: (value: number) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) return <NoData label={emptyLabel} />;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-3">
      {/* Labels are not unique — two dentists can share a name — so the index
          participates in the key. */}
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              {row.color && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
              )}
              <span className="truncate text-slate-700">{row.label}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">
              {formatValue(row.value)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: SEQ_SOFT }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0)}%`,
                backgroundColor: row.color ?? SEQ,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** KPI stat tile — the right form for a single headline number. */
export function StatTile({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={cn(
          'mt-2 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl',
          loading && 'h-9 w-24 animate-pulse rounded bg-slate-200',
        )}
      >
        {loading ? '' : value}
      </div>
      {hint && !loading && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
