"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { loadDemoData, startFresh } from "@/lib/actions/workspace";
import { SKILL_TEMPLATES } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

export function Onboarding() {
  const [templates, setTemplates] = useState<string[]>(["ai", "backend", "communication"]);
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"demo" | "fresh" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = (kind: "demo" | "fresh") => {
    setWhich(kind);
    setError(null);
    start(async () => {
      const res = kind === "demo" ? await loadDemoData() : await startFresh({ templates });
      if (res && !res.ok) setError(res.error);
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <section className="flex flex-col rounded-lg border border-accent/60 bg-panel p-5">
        <h2 className="font-semibold">Explore with demo data</h2>
        <p className="mt-1 flex-1 text-[13px] text-muted">
          Seven months of realistic history — skills, projects, goals, evidence — so every chart and insight has something to show. Clearly marked, removable in one click from Settings.
        </p>
        <Button variant="primary" className="mt-5 self-start" loading={pending && which === "demo"} disabled={pending} onClick={() => go("demo")}>
          Load demo workspace
        </Button>
      </section>
      <section className="flex flex-col rounded-lg border border-line bg-panel p-5">
        <h2 className="font-semibold">Start with my own data</h2>
        <p className="mt-1 text-[13px] text-muted">Pick starter skill sets (all editable), then set your starting levels and log your first activity.</p>
        <ul className="mt-4 flex flex-col gap-1.5">
          {SKILL_TEMPLATES.map((t) => {
            const on = templates.includes(t.key);
            return (
              <li key={t.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTemplates(on ? templates.filter((x) => x !== t.key) : [...templates, t.key])}
                  className={cn("flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left", on ? "border-accent bg-accent-soft" : "border-line hover:bg-hover")}
                >
                  <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>
                    {on ? <Check size={11} strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium">{t.name}</span>
                    <span className="block text-[12px] text-faint">{t.skills.join(", ")}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" className="mt-5 self-start" loading={pending && which === "fresh"} disabled={pending} onClick={() => go("fresh")}>
          {templates.length ? "Start with these skills" : "Start empty"}
        </Button>
      </section>
      {error ? (
        <p className="text-[13px] text-critical md:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
