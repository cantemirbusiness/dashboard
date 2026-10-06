"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { Logo } from "@/components/app/shell";

type State =
  | { kind: "working" }
  | { kind: "confirmed" } // email verified, but no session on this device
  | { kind: "expired" }
  | { kind: "error"; message: string };

function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Landing page for every Supabase email link (sign-up confirmation, magic
 * link, password reset). Handles all three formats Supabase can produce:
 *   #access_token=…&refresh_token=…  implicit flow (works on any device)
 *   ?token_hash=…&type=…             token-hash email templates
 *   ?code=…                          PKCE flow (same browser only)
 * The session is stored in cookies, then we do a full navigation so the
 * server sees it.
 */
export default function ConfirmPage() {
  const [state, setState] = useState<State>({ kind: "working" });

  useEffect(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const next = safeNext(q.get("next"));
    const go = (path: string) => window.location.replace(path);
    const supabase = createBrowserSupabase();

    const run = async (): Promise<State> => {
      const errorCode = hash.get("error_code") ?? q.get("error_code");
      const errorDescription = hash.get("error_description") ?? q.get("error_description");
      if (errorCode || errorDescription) {
        if (errorCode === "otp_expired" || /expired|invalid/i.test(errorDescription ?? "")) return { kind: "expired" };
        return { kind: "error", message: errorDescription ?? "The link could not be verified." };
      }

      // Implicit flow: tokens in the fragment.
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) return { kind: "expired" };
        go(hash.get("type") === "recovery" ? "/reset-password" : next);
        return { kind: "working" };
      }

      // Token-hash email templates.
      const tokenHash = q.get("token_hash");
      const type = q.get("type") as EmailOtpType | null;
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) return { kind: "expired" };
        go(type === "recovery" ? "/reset-password" : next);
        return { kind: "working" };
      }

      // PKCE: only works in the browser that started the flow. Supabase only
      // issues a code after verifying the link, so if the exchange fails here
      // the email IS confirmed; the user just needs to sign in on this device.
      const code = q.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          go(next);
          return { kind: "working" };
        }
        return { kind: "confirmed" };
      }

      return { kind: "error", message: "This link is incomplete. Open it directly from the email." };
    };

    run()
      .then(setState)
      .catch(() => setState({ kind: "error", message: "Something went wrong verifying the link. Please try again." }));
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Progress</span>
        </div>
        {state.kind === "working" ? (
          <div role="status" className="flex items-center gap-3 text-sm text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
            Signing you in…
          </div>
        ) : state.kind === "confirmed" ? (
          <Message title="Your email is confirmed">
            This link was opened on a different device or browser than the one you signed up on, so you&apos;re not signed in here yet. Sign in with your
            email and password to continue.
          </Message>
        ) : state.kind === "expired" ? (
          <Message title="This link has expired or was already used">
            Email links work once. If you already confirmed your email, just sign in. Otherwise request a new link from the sign-in page.
          </Message>
        ) : (
          <Message title="We couldn't verify that link">{state.message}</Message>
        )}
      </div>
    </main>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{children}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/login" className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-strong">
          Sign in
        </Link>
        <Link href="/forgot-password" className="inline-flex h-10 items-center rounded-md border border-line-strong px-4 text-sm hover:bg-hover">
          Reset password
        </Link>
      </div>
    </div>
  );
}
