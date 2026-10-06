/** An error whose message is safe to show to the user. */
export class UserError extends Error {}

/** Throw when a Supabase call failed; logs the details, shows a safe message. */
export function check<T extends { error: { message: string; code?: string } | null }>(res: T, what: string): T {
  if (res.error) {
    console.error(`[db] ${what}:`, res.error);
    if (res.error.code === "23505") throw new UserError("That name is already in use.");
    if (res.error.code === "23503") throw new UserError("A linked item no longer exists. Refresh and try again.");
    throw new UserError(`Could not ${what}. Please try again.`);
  }
  return res;
}
