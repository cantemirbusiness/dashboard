"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { resendConfirmation, sendMagicLink, signIn, signUp } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/fields";

type Notice = { tone: "info" | "warn"; text: string; action?: "resend" | "signin" };

export function AuthForm({ mode, next, linkError }: { mode: "login" | "signup"; next?: string; linkError?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magic, setMagic] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? "That sign-in link is invalid or has expired. Request a new one." : null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [pending, start] = useTransition();

  const reset = () => {
    setError(null);
    setFieldErrors({});
    setNotice(null);
  };

  const submit = () =>
    start(async () => {
      reset();
      if (mode === "signup") {
        const res = await signUp({ email, password });
        if (!res) return; // redirected
        if (!res.ok) {
          setError(res.error);
          setFieldErrors(res.fieldErrors ?? {});
        } else if (res.data?.status === "exists") {
          setNotice({ tone: "warn", text: "An account with this email already exists. Sign in instead — or reset your password if you don't remember it.", action: "signin" });
        } else {
          setNotice({ tone: "info", text: `We sent a confirmation link to ${email}. Open it on any device to finish signing up.` });
          setCanResend(true);
        }
        return;
      }
      if (magic) {
        const res = await sendMagicLink({ email, next });
        if (!res.ok) {
          setError(res.error);
          setFieldErrors(res.fieldErrors ?? {});
        } else setNotice({ tone: "info", text: "If an account exists for that email, a sign-in link is on its way." });
        return;
      }
      const res = await signIn({ email, password, next });
      if (!res) return; // redirected
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        if (/confirm/i.test(res.error)) setCanResend(true);
      }
    });

  const resend = () =>
    start(async () => {
      reset();
      const res = await resendConfirmation({ email });
      if (!res.ok) setError(res.error);
      else setNotice({ tone: "info", text: `If ${email} still needs confirming, a new link is on its way.` });
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h1 className="text-xl font-semibold">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
      <TextInput label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} required autoFocus />
      {!magic ? (
        <TextInput
          label="Password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint={
            mode === "signup" ? (
              "At least 8 characters."
            ) : (
              <Link href="/forgot-password" className="hover:text-fg">
                Forgot password?
              </Link>
            )
          }
          required
          minLength={8}
        />
      ) : null}
      {error ? (
        <p className="text-[13px] text-critical" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <div className={`rounded-md border px-3 py-2 text-[13px] ${notice.tone === "warn" ? "border-warning/50 text-fg" : "border-line bg-panel-2 text-muted"}`} role="status">
          {notice.text}
          {notice.action === "signin" ? (
            <span className="mt-2 flex gap-3">
              <Link href="/login" className="font-medium text-accent hover:underline">
                Sign in
              </Link>
              <Link href="/forgot-password" className="text-accent hover:underline">
                Reset password
              </Link>
            </span>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" variant="primary" loading={pending}>
        {mode === "signup" ? "Create account" : magic ? "Email me a sign-in link" : "Sign in"}
      </Button>
      {canResend && email ? (
        <Button variant="ghost" onClick={resend} disabled={pending}>
          Resend confirmation email
        </Button>
      ) : null}
      {mode === "login" ? (
        <button type="button" onClick={() => setMagic((m) => !m)} className="text-[13px] text-muted hover:text-fg">
          {magic ? "Use a password instead" : "Email me a sign-in link instead"}
        </button>
      ) : null}
      <p className="border-t border-line pt-4 text-center text-[13px] text-muted">
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup" className="text-accent hover:underline">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
