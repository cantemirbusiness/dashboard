import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/shell";
import type { AppData } from "@/components/app/app-data";
import { getUserEmail, getWorkspace } from "@/lib/data/workspace";
import { addDays } from "@/lib/dates";
import { isPreviewMode } from "@/lib/supabase/env";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [ws, email] = await Promise.all([getWorkspace(), getUserEmail()]);
  const preview = isPreviewMode();
  if (!preview && !ws.profile.onboardedAt && ws.skills.length === 0) redirect("/welcome");

  const since = addDays(ws.today, -30);
  const recent = new Map<string, number>();
  for (const a of ws.activities) {
    if (a.occurredOn <= since) continue;
    for (const s of a.skillIds) recent.set(s, (recent.get(s) ?? 0) + 1);
  }

  const data: AppData = {
    today: ws.today,
    readOnly: preview,
    categories: ws.categories.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    skills: ws.skills.filter((s) => !s.archived).map((s) => ({ id: s.id, name: s.name, categoryId: s.categoryId, recent: recent.get(s.id) ?? 0 })),
    projects: ws.projects.map((p) => ({ id: p.id, name: p.name, status: p.status, skillIds: p.skillIds })),
    goals: ws.goals.map((g) => ({ id: g.id, title: g.title })),
    milestones: ws.milestones.map((m) => ({ id: m.id, title: m.title })),
  };

  const hasDemo = ws.skills.some((s) => s.isDemo) || ws.activities.some((a) => a.isDemo);
  const banner = preview ? (
    <Banner>Preview mode — in-memory demo data, nothing is saved. Configure Supabase to use the real app.</Banner>
  ) : hasDemo ? (
    <Banner>
      You&apos;re exploring demo data.{" "}
      <Link href="/settings#data" className="font-medium text-fg underline underline-offset-2">
        Clear it
      </Link>{" "}
      when you&apos;re ready to track your own progress.
    </Banner>
  ) : null;

  return (
    <AppShell data={data} email={email} banner={banner}>
      {children}
    </AppShell>
  );
}

function Banner({ children }: { children: ReactNode }) {
  return <div className="border-b border-line bg-accent-soft px-4 py-2 text-center text-[12.5px] text-muted sm:px-6">{children}</div>;
}
