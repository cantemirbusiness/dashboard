import { fmtHours } from "@/lib/format";

/** Serializable value formats (functions can't cross the server → client boundary). */
export type ValueFormat = "score" | "int" | "hours" | "percent" | { unit: string; position: "prefix" | "suffix" };

export function formatValue(v: number, f: ValueFormat = "score"): string {
  if (f === "score") return v.toFixed(1);
  if (f === "int") return String(Math.round(v));
  if (f === "hours") return fmtHours(v);
  if (f === "percent") return `${Math.round(v)}%`;
  const n = Math.round(v).toLocaleString("en");
  return f.position === "prefix" ? `${f.unit}${n}` : `${n} ${f.unit}`;
}
