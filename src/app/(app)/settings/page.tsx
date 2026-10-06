import { Download } from "lucide-react";
import { getUserEmail, getWorkspace } from "@/lib/data/workspace";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { DemoDataControls, ProfileForm } from "@/components/forms/settings-forms";
import { PageHeader, Section } from "@/components/ui/display";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [ws, email] = await Promise.all([getWorkspace(), getUserEmail()]);
  const demoCount = [ws.skills, ws.activities, ws.projects, ws.goals, ws.evidence, ws.milestones].reduce((n, list) => n + list.filter((x) => x.isDemo).length, 0);
  const counts = [
    ["Skills", ws.skills.length],
    ["Activities", ws.activities.length],
    ["Projects", ws.projects.length],
    ["Goals", ws.goals.length],
    ["Evidence", ws.evidence.length],
    ["Milestones", ws.milestones.length],
  ] as const;

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <PageHeader title="Settings" description={email ? `Signed in as ${email}` : undefined} />

      <Section title="Profile">
        <ProfileForm profile={ws.profile} />
      </Section>

      <Section title="Appearance">
        <ThemeToggle />
      </Section>

      <Section id="data" title="Your data">
        <dl className="mb-5 grid grid-cols-3 gap-3 text-[13px] sm:grid-cols-6">
          {counts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-faint">{k}</dt>
              <dd className="tabular font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[13px] text-muted">
              {demoCount
                ? `${demoCount} demo records are loaded. They exist so you can evaluate the dashboard; remove them when you start tracking for real.`
                : "Demo data lets you explore every feature with seven months of realistic history. It is flagged and can be removed in one click."}
            </p>
            <DemoDataControls hasDemo={demoCount > 0} />
          </div>
          <div>
            <p className="mb-2 text-[13px] text-muted">Download everything you&apos;ve recorded as JSON.</p>
            <a href="/api/export" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-panel-2 px-3.5 text-sm hover:bg-hover">
              <Download size={15} /> Export data
            </a>
          </div>
        </div>
      </Section>
    </div>
  );
}
