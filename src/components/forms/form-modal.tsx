"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useAppData } from "@/components/app/app-data";

/** A button that opens a modal containing a form. The form receives `close`. */
export function FormModalButton({
  title,
  label,
  icon,
  variant = "secondary",
  size = "sm",
  className,
  children,
}: {
  title: string;
  label: ReactNode;
  icon?: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const { readOnly } = useAppData();
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
        disabled={readOnly}
        title={readOnly ? "Read-only preview" : undefined}
      >
        {icon}
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div key={key}>{children(() => setOpen(false))}</div>
      </Modal>
    </>
  );
}

export function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky -bottom-4 -mx-4 -mb-4 mt-2 flex items-center gap-2 border-t border-line bg-panel px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-5 sm:px-5">
      {children}
    </div>
  );
}

/** Two-step delete: first click arms, second click deletes. */
export function DeleteButton({ onDelete, pending, label = "Delete" }: { onDelete: () => void; pending?: boolean; label?: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button variant="danger" size="md" loading={pending} onClick={() => (armed ? onDelete() : setArmed(true))} onBlur={() => setArmed(false)}>
      {armed ? "Click again to confirm" : label}
    </Button>
  );
}
