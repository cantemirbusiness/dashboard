"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendMagicLink, signIn, signUp } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/fields";

export function AuthForm({ mode, next, linkError }: { mode: "login" | "signup"; next?: string; linkError?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magic, setMagic] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? "That sign-in link is invalid or has expired. Request a new one." : null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      setFieldErrors({});
      setNotice(null);
      const res =
        mode === "signup" ? await signUp({ email, password }) : magic ? await sendMagicLink({ email, next }) : await signIn({ email, password, next });
      if (!res) return;
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      } else if (mode === "signup") {
        setNotice("Check your inbox to confirm your email, then sign in.");
      } else if (magic) {
        setNotice("If an account exists for that email, a sign-in link is on its way.");
      }
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
          hint={mode === "signup" ? "At least 8 characters." : undefined}
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
        <p className="rounded-md border border-line bg-panel-2 px-3 py-2 text-[13px] text-muted" role="status">
          {notice}
        </p>
      ) : null}
      <Button type="submit" variant="primary" loading={pending}>
        {mode === "signup" ? "Create account" : magic ? "Email me a sign-in link" : "Sign in"}
      </Button>
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
