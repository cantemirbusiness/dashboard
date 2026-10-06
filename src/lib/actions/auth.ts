"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, emailSchema, fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./result";

async function origin() {
  const h = await headers();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) return site.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Only allow same-site relative redirects after login. */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(input: { email: string; password: string; next?: string }): Promise<ActionResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check your email and password.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      error: error.code === "email_not_confirmed" ? "Confirm your email first — check your inbox." : "Incorrect email or password.",
    };
  }
  redirect(safeNext(input.next));
}

export async function signUp(input: { email: string; password: string }): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await origin()}/auth/confirm?next=/welcome` },
  });
  if (error) {
    console.error("[auth] sign up", error.message);
    return { ok: false, error: error.code === "weak_password" ? "Choose a stronger password." : "Could not create the account. Try again." };
  }
  if (data.session) redirect("/welcome");
  return { ok: true, data: { needsConfirmation: true } };
}

export async function sendMagicLink(input: { email: string; next?: string }): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid email.", fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(safeNext(input.next))}` },
  });
  // Do not reveal whether an account exists.
  if (error) console.error("[auth] magic link", error.message);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
