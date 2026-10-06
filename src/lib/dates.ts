// Calendar-date helpers. All dates are ISO "YYYY-MM-DD" strings and arithmetic
// is done in UTC so it never drifts across DST changes.

const DAY_MS = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
}

/** Today's calendar date in an IANA timezone. Falls back to UTC on bad input. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    return parts; // en-CA formats as YYYY-MM-DD
  } catch {
    return toIso(now);
  }
}

/** Monday of the ISO week containing `iso`. */
export function startOfWeek(iso: string): string {
  const day = toDate(iso).getUTCDay(); // 0 = Sunday
  const offset = (day + 6) % 7;
  return addDays(iso, -offset);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

export function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string, opts: { year?: boolean } = {}): string {
  const d = toDate(iso);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return opts.year ? `${base}, ${d.getUTCFullYear()}` : base;
}

export function formatMonth(iso: string): string {
  const d = toDate(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "today", "yesterday", "5d ago", "3w ago", or a date. */
export function relativeDay(iso: string, today: string): string {
  const diff = daysBetween(iso, today);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 0) {
    const ahead = -diff;
    if (ahead === 1) return "tomorrow";
    if (ahead < 14) return `in ${ahead}d`;
    if (ahead < 60) return `in ${Math.round(ahead / 7)}w`;
    return formatDate(iso, { year: true });
  }
  if (diff < 14) return `${diff}d ago`;
  if (diff < 60) return `${Math.round(diff / 7)}w ago`;
  return formatDate(iso, { year: true });
}
