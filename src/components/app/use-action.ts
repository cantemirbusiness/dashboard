"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions/result";
import { useToast } from "@/components/ui/toast";

/** Runs a server action with pending state, field errors and toast feedback. */
export function useAction<I, O>(action: (input: I) => Promise<ActionResult<O>>, opts: { success?: string; onSuccess?: (data?: O) => void } = {}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const toast = useToast();
  const router = useRouter();

  const run = (input: I) =>
    new Promise<boolean>((resolve) => {
      start(async () => {
        setError(null);
        setFieldErrors({});
        try {
          const res = await action(input);
          if (res.ok) {
            if (opts.success) toast(opts.success);
            opts.onSuccess?.(res.data);
            router.refresh();
            resolve(true);
          } else {
            setError(res.error);
            setFieldErrors(res.fieldErrors ?? {});
            if (!res.fieldErrors) toast(res.error, "error");
            resolve(false);
          }
        } catch (e) {
          // redirect() from an action surfaces here as a navigation; anything else is a network/server failure.
          if (e && typeof e === "object" && "digest" in e) throw e;
          setError("Network error — check your connection and try again.");
          toast("Network error — try again.", "error");
          resolve(false);
        }
      });
    });

  return { run, pending, error, fieldErrors };
}
