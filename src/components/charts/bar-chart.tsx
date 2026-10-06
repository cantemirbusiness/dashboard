"use client";

import { useState } from "react";
import { formatValue, type ValueFormat } from "./format";
import { useWidth } from "./use-width";

/** Vertical columns (e.g. hours per week). Hover/tap a column for its value. */
export function BarChart({
  bars,
  height = 140,
  ariaLabel,
  format = "score",
  highlightLast = true,
}: {
  bars: { label: string; value: number; secondary?: number; detail?: string }[];
  height?: number;
  ariaLabel: string;
  format?: ValueFormat;
  highlightLast?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const m = { top: 8, bottom: 20 };
  const ih = height - m.top - m.bottom;
  const slot = width / Math.max(1, bars.length);
  const bw = Math.max(4, Math.min(28, slot - 6));
  const every = Math.ceil(bars.length / Math.max(1, Math.floor(width / 48)));

  return (
    <div ref={ref} className="relative w-full min-w-0" style={{ height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="absolute inset-0" onPointerLeave={() => setHover(null)}>
        <line x1={0} x2={width} y1={m.top + ih} y2={m.top + ih} stroke="var(--grid)" />
        {bars.map((b, i) => {
          const h = (b.value / max) * ih;
          const sh = b.secondary != null ? (b.secondary / max) * ih : 0;
          const cx = slot * i + slot / 2;
          const isLast = highlightLast && i === bars.length - 1;
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={slot * i} y={m.top} width={slot} height={ih} fill="transparent" />
              {b.value > 0 ? (
                <rect
                  x={cx - bw / 2}
                  y={m.top + ih - h}
                  width={bw}
                  height={h}
                  rx={3}
                  fill={isLast ? "var(--accent)" : "var(--border-strong)"}
                  opacity={hover == null || hover === i ? 1 : 0.6}
                />
              ) : null}
              {sh > 0 ? <rect x={cx - bw / 2} y={m.top + ih - sh} width={bw} height={sh} rx={3} fill={isLast ? "var(--accent-strong)" : "var(--fg-faint)"} opacity={0.9} /> : null}
              {i % every === 0 || i === bars.length - 1 ? (
                <text x={cx} y={height - 5} textAnchor="middle" fontSize={10.5} fill="var(--fg-faint)">
                  {b.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover != null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-md border border-line-strong bg-panel-2 px-2 py-1 text-[12px] shadow-[var(--shadow)]"
          style={{ left: Math.min(Math.max(slot * hover + slot / 2 - 60, 0), width - 120), width: 120 }}
        >
          <div className="text-faint">{bars[hover].label}</div>
          <div className="tabular font-medium">{formatValue(bars[hover].value, format)}</div>
          {bars[hover].detail ? <div className="text-muted">{bars[hover].detail}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
