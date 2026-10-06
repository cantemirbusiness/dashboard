"use client";

import { useState } from "react";
import type { Profile } from "@/lib/domain";
import { saveProfile } from "@/lib/actions/entities";
import { clearDemoData, loadDemoData } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/fields";
import { useAction } from "@/components/app/use-action";
import { useAppData } from "@/components/app/app-data";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [displayName, setName] = useState(profile.displayName ?? "");
  const [timezone, setTz] = useState(profile.timezone);
  const [weeklyHoursGoal, setGoal] = useState(String(profile.weeklyHoursGoal));
  const { run, pending, fieldErrors } = useAction(saveProfile, { success: "Settings saved" });
  const { readOnly } = useAppData();
  return (
    <form
      className="flex max-w-lg flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run({ displayName, timezone, weeklyHoursGoal });
      }}
    >
      <TextInput label="Display name" value={displayName} onChange={(e) => setName(e.target.value)} maxLength={80} error={fieldErrors.displayName} />
      <div className="flex items-end gap-2">
        <TextInput label="Timezone" value={timezone} onChange={(e) => setTz(e.target.value)} error={fieldErrors.timezone} hint="Decides what “today” means for streaks and dates." className="flex-1" />
        <Button size="md" variant="ghost" onClick={() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone)} className="mb-[22px]">
          Detect
        </Button>
      </div>
      <TextInput label="Weekly hours goal" type="number" inputMode="decimal" min={0} max={120} value={weeklyHoursGoal} onChange={(e) => setGoal(e.target.value)} error={fieldErrors.weeklyHoursGoal} />
      <Button type="submit" variant="primary" loading={pending} disabled={readOnly} className="self-start">
        Save settings
      </Button>
    </form>
  );
}

export function DemoDataControls({ hasDemo }: { hasDemo: boolean }) {
  const [armed, setArmed] = useState(false);
  const clear = useAction(clearDemoData, { success: "Demo data removed", onSuccess: () => setArmed(false) });
  const load = useAction(loadDemoData);
  const { readOnly } = useAppData();
  if (hasDemo) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="danger" loading={clear.pending} disabled={readOnly} onClick={() => (armed ? clear.run(undefined) : setArmed(true))} onBlur={() => setArmed(false)}>
          {armed ? "Click again to delete all demo data" : "Clear demo data"}
        </Button>
        <span className="text-[12px] text-faint">Only records marked as demo are deleted. Your own entries stay.</span>
      </div>
    );
  }
  return (
    <Button variant="secondary" loading={load.pending} disabled={readOnly} onClick={() => load.run({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>
      Load demo data
    </Button>
  );
}
