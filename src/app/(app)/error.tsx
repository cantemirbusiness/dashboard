"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/display";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle size={22} />}
      title="This page couldn't load"
      action={
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      }
    >
      {error.message.startsWith("Failed to load")
        ? "The database didn't respond as expected. Check your connection and that the migrations have been applied."
        : "An unexpected error occurred."}
      {error.digest ? <span className="mt-2 block text-faint">Reference: {error.digest}</span> : null}
    </EmptyState>
  );
}
