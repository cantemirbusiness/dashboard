"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Activity } from "@/lib/domain";
import { Modal } from "@/components/ui/modal";
import { ActivityForm } from "./activity-form";

interface OpenOptions {
  activity?: Activity;
  skillId?: string;
  projectId?: string;
}

const Ctx = createContext<(opts?: OpenOptions) => void>(() => {});

export function useQuickAdd() {
  return useContext(Ctx);
}

/** Global "log activity" sheet. Open with the + buttons or the `n` key from anywhere. */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; opts: OpenOptions; key: number }>({ open: false, opts: {}, key: 0 });
  const open = useCallback((opts: OpenOptions = {}) => setState((s) => ({ open: true, opts, key: s.key + 1 })), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Ctx.Provider value={open}>
      {children}
      <Modal open={state.open} onClose={close} title={state.opts.activity ? "Edit activity" : "Log activity"}>
        <ActivityForm
          key={state.key}
          activity={state.opts.activity}
          presetSkillId={state.opts.skillId}
          presetProjectId={state.opts.projectId}
          onDone={close}
        />
      </Modal>
    </Ctx.Provider>
  );
}

export function QuickAddButton({ children, className, skillId, projectId }: { children: ReactNode; className?: string; skillId?: string; projectId?: string }) {
  const open = useQuickAdd();
  return (
    <button type="button" className={className} onClick={() => open({ skillId, projectId })}>
      {children}
    </button>
  );
}
