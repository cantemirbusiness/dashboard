"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPasswordReset, updatePassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/fields";

export function PasswordResetRequest() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await requestPasswordReset({ email });
          if (!res.ok) setError(res.error);
          else setSent(true);
        });
      }}
    >
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="-mt-2 text-[13px] text-muted">We&apos;ll email you a link to choose a new password. It works on any device.</p>
      <TextInput label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      {error ? (
        <p className="text-[13px] text-critical" role="alert">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p className="rounded-md border border-line bg-panel-2 px-3 py-2 text-[13px] text-muted" role="status">
          If an account exists for {email}, a reset link is on its way.
        </p>
      ) : null}
      <Button type="submit" variant="primary" loading={pending}>
        Send reset link
      </Button>
      <p className="border-t border-line pt-4 text-center text-[13px] text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function NewPasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          setFieldError(undefined);
          const res = await updatePassword({ password });
          if (res && !res.ok) {
            setError(res.error);
            setFieldError(res.fieldErrors?.password);
          }
        });
      }}
    >
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <TextInput
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldError}
        hint="At least 8 characters."
        required
        minLength={8}
        autoFocus
      />
      {error ? (
        <p className="text-[13px] text-critical" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" loading={pending}>
        Save password
      </Button>
    </form>
  );
}
