import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** A titled region. Sections are separated by space and hairlines, not heavy cards. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 scroll-mt-20", className)}>
      {title || actions ? (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-faint">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Bordered surface — used for grouped content, not for every element. */
export function Panel({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "article" | "li" }) {
  return <As className={cn("rounded-lg border border-line bg-panel", className)}>{children}</As>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13px] text-muted sm:text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Delta({ value, suffix, className, precision = 1 }: { value: number | null; suffix?: string; className?: string; precision?: number }) {
  if (value == null) return <span className={cn("text-faint", className)}>—</span>;
  const r = Number(value.toFixed(precision));
  const Icon = r > 0 ? ArrowUpRight : r < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 font-medium",
        r > 0 ? "text-good" : r < 0 ? "text-critical" : "text-faint",
        className,
      )}
    >
      <Icon size={14} aria-hidden />
      {r > 0 ? "+" : r < 0 ? "−" : "±"}
      {Math.abs(r).toFixed(precision)}
      {suffix ? <span className="ml-1 font-normal text-faint">{suffix}</span> : null}
    </span>
  );
}

/** Thin progress meter with an optional target tick. */
export function Meter({
  value,
  max = 100,
  target,
  baseline,
  color = "var(--accent)",
  className,
  label,
}: {
  value: number;
  max?: number;
  target?: number;
  baseline?: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <div
      className={cn("relative h-1.5 w-full rounded-full bg-panel-2", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      {baseline != null && baseline > 0 ? (
        <div className="absolute inset-y-0 left-0 rounded-full bg-line-strong" style={{ width: pct(Math.min(baseline, value)) }} />
      ) : null}
      <div
        className="absolute inset-y-0 rounded-full"
        style={{
          left: baseline != null && baseline > 0 ? pct(Math.min(baseline, value)) : 0,
          width: baseline != null && baseline > 0 ? `calc(${pct(value)} - ${pct(Math.min(baseline, value))})` : pct(value),
          background: color,
        }}
      />
      {target != null ? (
        <div className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-fg/70" style={{ left: `calc(${pct(target)} - 1px)` }} title={`Target ${target}`} />
      ) : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="truncate text-[12px] text-faint">{label}</div>
      <div className="tabular mt-0.5 text-lg font-semibold leading-tight sm:text-xl">{value}</div>
      {sub ? <div className="mt-0.5 truncate text-[12px] text-muted">{sub}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-3 text-faint">{icon}</div> : null}
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 max-w-md text-[13px] text-muted">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-panel-2", className)} />;
}

export function Tag({ children, className, color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded border border-line px-1.5 py-px text-[12px] text-muted", className)}>
      {color ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden /> : null}
      {children}
    </span>
  );
}
