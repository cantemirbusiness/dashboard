"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CategoryColor } from "@/lib/domain";

/** Lightweight lists the client-side forms need (pickers), passed down from the server layout. */
export interface AppData {
  today: string;
  readOnly: boolean;
  categories: { id: string; name: string; color: CategoryColor }[];
  skills: { id: string; name: string; categoryId: string | null; recent: number }[];
  projects: { id: string; name: string; status: string; skillIds: string[] }[];
  goals: { id: string; title: string }[];
  milestones: { id: string; title: string }[];
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ value, children }: { value: AppData; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside AppDataProvider");
  return v;
}
