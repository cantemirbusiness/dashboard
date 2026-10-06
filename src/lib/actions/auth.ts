"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createEmailLinkClient } from "@/lib/supabase/email-links";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, emailSchema, fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./result";

async function origin() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) return site.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Only allow same-site relative redirects after login. */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Every email link lands on /auth/confirm (the URL allow-listed in Supabase). */
async function confirmUrl(next: string) {
  return `${await origin()}/auth/confirm?next=${encodeURIComponent(next)}`;
}

function rateLimited(error: { code?: string; status?: number }) {
  return error.code === "over_email_send_rate_limit" || error.status === 429;
}

export type SignInResult = ActionResult<{ unconfirmed?: boolean }>;

export async function signIn(input: { email: string; password: string; next?: string }): Promise<SignInResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check your email and password.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Your email isn't confirmed yet. Use the link we emailed you, or send a new one below." };
    }
    if (error.code === "invalid_credentials") return { ok: false, error: "Incorrect email or password." };
    console.error("[auth] sign in", error.code, error.message);
    return { ok: false, error: "Sign-in failed. Please try again in a moment." };
  }
  redirect(safeNext(input.next));
}

export type SignUpResult = ActionResult<{ status: "confirm_email" | "exists" }>;

export async function signUp(input: { email: string; password: string }): Promise<SignUpResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { data, error } = await createEmailLinkClient().auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: await confirmUrl("/welcome") },
  });
  if (error) {
    if (error.code === "weak_password") return { ok: false, error: "Choose a stronger password." };
    if (rateLimited(error)) return { ok: false, error: "Too many emails were requested. Wait a minute and try again." };
    console.error("[auth] sign up", error.code, error.message);
    return { ok: false, error: "Could not create the account. Try again." };
  }
  // Supabase answers a sign-up for an already-registered email with a user that
  // has no identities (and sends no email) to avoid revealing which emails exist.
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { ok: true, data: { status: "exists" } };
  }
  // Email confirmation disabled in Supabase: we already have a session.
  if (data.session) {
    const supabase = await createClient();
    await supabase.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    redirect("/welcome");
  }
  return { ok: true, data: { status: "confirm_email" } };
}

export async function resendConfirmation(input: { email: string }): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email.", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await createEmailLinkClient().auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: await confirmUrl("/welcome") },
  });
  if (error) {
    if (rateLimited(error)) return { ok: false, error: "Please wait a minute before requesting another email." };
    console.error("[auth] resend", error.code, error.message);
  }
  return { ok: true };
}

export async function sendMagicLink(input: { email: string; next?: string }): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email.", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await createEmailLinkClient().auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: await confirmUrl(safeNext(input.next)) },
  });
  if (error) {
    if (rateLimited(error)) return { ok: false, error: "Please wait a minute before requesting another email." };
    // Do not reveal whether an account exists.
    console.error("[auth] magic link", error.code, error.message);
  }
  return { ok: true };
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email.", fieldErrors: fieldErrors(parsed.error) };
  const { error } = await createEmailLinkClient().auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await confirmUrl("/reset-password"),
  });
  if (error) {
    if (rateLimited(error)) return { ok: false, error: "Please wait a minute before requesting another email." };
    // Do not reveal whether an account exists.
    console.error("[auth] reset", error.code, error.message);
  }
  return { ok: true };
}

const newPasswordSchema = z.object({ password: z.string().min(8, "At least 8 characters").max(128) });

export async function updatePassword(input: { password: string }): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted field.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { ok: false, error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "That's your current password — choose a new one." };
    if (error.code === "weak_password") return { ok: false, error: "Choose a stronger password." };
    console.error("[auth] update password", error.code, error.message);
    return { ok: false, error: "Could not update the password. Try again." };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
