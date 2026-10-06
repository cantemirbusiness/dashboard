"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatValue, type ValueFormat } from "./format";
import { useWidth } from "./use-width";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  points: { date: string; value: number }[];
  dashed?: boolean;
}

/**
 * Multi-series line chart over calendar dates. One y-axis only.
 * Hover / touch shows a crosshair with every series' value at that date.
 */
export function LineChart({
  series,
  height = 220,
  yDomain,
  reference,
  ariaLabel,
  valueFormat = "score",
}: {
  series: LineSeries[];
  height?: number;
  yDomain?: [number, number];
  reference?: { value: number; label: string }[];
  ariaLabel: string;
  valueFormat?: ValueFormat;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const s of series) for (const p of s.points) set.add(p.date);
    return [...set].sort();
  }, [series]);

  const [y0, y1] = useMemo(() => {
    if (yDomain) return yDomain;
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) for (const p of s.points) {
      lo = Math.min(lo, p.value);
      hi = Math.max(hi, p.value);
    }
    for (const r of reference ?? []) {
      lo = Math.min(lo, r.value);
      hi = Math.max(hi, r.value);
    }
    if (!Number.isFinite(lo)) return [0, 100] as [number, number];
    const pad = Math.max(2, (hi - lo) * 0.15);
    return [Math.max(0, Math.floor((lo - pad) / 5) * 5), Math.ceil((hi + pad) / 5) * 5] as [number, number];
  }, [series, yDomain, reference]);

  const m = { top: 10, right: 12, bottom: 24, left: 32 };
  const iw = Math.max(10, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const t0 = dates.length ? Date.parse(dates[0]) : 0;
  const t1 = dates.length ? Date.parse(dates[dates.length - 1]) : 1;
  const x = (d: string) => m.left + (t1 === t0 ? iw / 2 : ((Date.parse(d) - t0) / (t1 - t0)) * iw);
  const y = (v: number) => m.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;

  const ticks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
  }, [y0, y1]);
  const xTicks = useMemo(() => {
    if (dates.length <= 1) return dates;
    const count = Math.max(2, Math.min(6, Math.floor(iw / 90)));
    const out: string[] = [];
    for (let i = 0; i < count; i++) out.push(dates[Math.round((i / (count - 1)) * (dates.length - 1))]);
    return [...new Set(out)];
  }, [dates, iw]);

  const onMove = (clientX: number, rect: DOMRect) => {
    if (!dates.length) return;
    const px = clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    dates.forEach((d, i) => {
      const dist = Math.abs(x(d) - px);
      if (dist < bestD) {
        bestD = dist;
        best = i;
      }
    });
    setHover(best);
  };

  const hd = hover != null ? dates[hover] : null;
  const tooltipLeft = hd ? Math.min(Math.max(x(hd) - 80, 0), width - 168) : 0;

  return (
    <div ref={ref} className="relative w-full min-w-0 select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="absolute inset-0 block touch-pan-y"
        onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--fg-faint)" className="tabular">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {xTicks.map((d, i) => (
          <text
            key={d}
            x={x(d)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fontSize={11}
            fill="var(--fg-faint)"
          >
            {formatDate(d)}
          </text>
        ))}
        {(reference ?? []).map((r) => (
          <g key={r.label}>
            <line x1={m.left} x2={width - m.right} y1={y(r.value)} y2={y(r.value)} stroke="var(--fg-faint)" strokeDasharray="3 4" strokeWidth={1} />
            <text x={width - m.right} y={y(r.value) - 5} textAnchor="end" fontSize={11} fill="var(--fg-muted)">
              {r.label}
            </text>
          </g>
        ))}
        {series.map((s) => {
          if (!s.points.length) return null;
          const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.key}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "4 4" : undefined} />
              <circle cx={x(last.date)} cy={y(last.value)} r={3.5} fill={s.color} stroke="var(--panel)" strokeWidth={2} />
            </g>
          );
        })}
        {hd ? (
          <g pointerEvents="none">
            <line x1={x(hd)} x2={x(hd)} y1={m.top} y2={m.top + ih} stroke="var(--fg-faint)" strokeWidth={1} />
            {series.map((s) => {
              const p = s.points.find((pt) => pt.date === hd);
              return p ? <circle key={s.key} cx={x(hd)} cy={y(p.value)} r={4} fill={s.color} stroke="var(--panel)" strokeWidth={2} /> : null;
            })}
          </g>
        ) : null}
      </svg>
      {hd ? (
        <div
          className="pointer-events-none absolute top-0 z-10 w-[168px] rounded-md border border-line-strong bg-panel-2 px-2.5 py-2 text-[12px] shadow-[var(--shadow)]"
          style={{ left: tooltipLeft }}
        >
          <div className="mb-1 text-faint">{formatDate(hd, { year: true })}</div>
          {series.map((s) => {
            const p = s.points.find((pt) => pt.date === hd);
            if (!p) return null;
            return (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="tabular font-medium text-fg">{formatValue(p.value, valueFormat)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3.5 rounded"
            style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 3px, transparent 3px 6px)` : i.color }}
            aria-hidden
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
