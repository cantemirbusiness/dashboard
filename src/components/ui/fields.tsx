"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

const control =
  "w-full rounded-md border border-line-strong bg-panel-2 px-3 text-[16px] sm:text-sm text-fg placeholder:text-faint transition-colors focus:border-accent focus:outline-none disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium uppercase tracking-wide text-faint">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-critical" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  label,
  error,
  hint,
  className,
  ...rest
}: ComponentProps<"input"> & { label: string; error?: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id} className={className}>
      <input id={id} aria-invalid={!!error || undefined} className={cn(control, "h-10")} {...rest} />
    </Field>
  );
}

export function TextArea({
  label,
  error,
  hint,
  className,
  ...rest
}: ComponentProps<"textarea"> & { label: string; error?: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id} className={className}>
      <textarea id={id} aria-invalid={!!error || undefined} className={cn(control, "min-h-20 py-2 leading-normal")} {...rest} />
    </Field>
  );
}

export function SelectInput({
  label,
  error,
  hint,
  className,
  children,
  ...rest
}: ComponentProps<"select"> & { label: string; error?: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id} className={className}>
      <select id={id} aria-invalid={!!error || undefined} className={cn(control, "h-10 pr-8")} {...rest}>
        {children}
      </select>
    </Field>
  );
}

/** Single-choice segmented control — large touch targets, keyboard accessible (radio group). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const name = useId();
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-faint">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              title={o.title}
              className={cn(
                "cursor-pointer select-none rounded-md border px-2.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--focus)]",
                size === "sm" ? "py-1 text-[13px]" : "py-1.5 text-sm",
                checked ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-muted hover:bg-hover hover:text-fg",
              )}
            >
              <input type="radio" name={name} className="sr-only" checked={checked} onChange={() => onChange(o.value)} />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Multi-select as toggle chips. */
export function ChipSelect({
  label,
  values,
  options,
  onChange,
  error,
  className,
  max,
  emptyText = "Nothing to choose yet.",
  collapseAfter,
}: {
  label: string;
  values: string[];
  options: { value: string; label: string; group?: string }[];
  onChange: (v: string[]) => void;
  error?: string;
  className?: string;
  max?: number;
  emptyText?: string;
  /** Show only the first N options (plus any selected) until expanded. */
  collapseAfter?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const collapsed = !!collapseAfter && !expanded && options.length > collapseAfter + 2;
  const visible = collapsed ? options.filter((o, i) => i < collapseAfter! || values.includes(o.value)) : options;
  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else if (!max || values.length < max) onChange([...values, v]);
  };
  return (
    <fieldset className={cn("flex flex-col", className)}>
      <legend className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-faint">{label}</legend>
      {options.length === 0 ? <p className="text-[13px] text-faint">{emptyText}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {visible.map((o) => {
          const on = values.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              aria-pressed={on}
              onClick={() => toggle(o.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                on ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-muted hover:bg-hover hover:text-fg",
              )}
            >
              {o.label}
            </button>
          );
        })}
        {collapsed ? (
          <button type="button" onClick={() => setExpanded(true)} className="rounded-full px-2.5 py-1 text-[13px] text-faint hover:text-fg">
            +{options.length - visible.length} more
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-[12px] text-critical" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
