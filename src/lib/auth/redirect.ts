/**
 * Where to send the user after signing in. Only same-site absolute paths are
 * allowed; anything else falls back to "/" (prevents open redirects such as
 * "//evil.com" or "/\evil.com", which browsers treat as another host).
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.includes("\\")) return "/";
  // Reject control characters (e.g. "/\t/evil.com" is normalised to "//evil.com").
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}
