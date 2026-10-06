"use client";

import { Check, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/dates";
import { GOAL_STATES, PRIORITIES, type Goal, type GoalMeasure, type GoalState, type Milestone, type Priority } from "@/lib/domain";
import { deleteGoal, deleteMilestone, saveGoal, saveMilestone, toggleMilestone, updateGoalValue } from "@/lib/actions/entities";
import { Button } from "@/components/ui/button";
import { ChipSelect, Segmented, SelectInput, TextArea, TextInput } from "@/components/ui/fields";
import { useAppData } from "@/components/app/app-data";
import { useAction } from "@/components/app/use-action";
import { cn } from "@/components/ui/cn";
import { DeleteButton, FormFooter, FormModalButton } from "./form-modal";

const MEASURE_HINT: Record<GoalMeasure, string> = {
  skills: "Progress = average score of the linked skills (0–100). Tracked automatically from your activity and evidence.",
  milestones: "Progress = share of this goal's milestones achieved.",
  manual: "You update the current value yourself — e.g. € earned, users, chapters.",
};

export function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const data = useAppData();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [categoryId, setCategoryId] = useState(goal?.categoryId ?? "");
  const [horizon, setHorizon] = useState<"short" | "long">(goal?.horizon ?? "long");
  const [measure, setMeasure] = useState<GoalMeasure>(goal?.measure ?? "skills");
  const [unit, setUnit] = useState(goal?.unit ?? "");
  const [startValue, setStartValue] = useState(String(goal?.startValue ?? 0));
  const [currentValue, setCurrentValue] = useState(String(goal?.currentValue ?? 0));
  const [targetValue, setTargetValue] = useState(String(goal?.targetValue ?? 70));
  const [startDate, setStartDate] = useState(goal?.startDate ?? data.today);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [priority, setPriority] = useState<Priority>(goal?.priority ?? "medium");
  const [state, setState] = useState<GoalState>(goal?.state ?? "active");
  const [skillIds, setSkillIds] = useState<string[]>(goal?.skillIds ?? []);
  const [projectIds, setProjectIds] = useState<string[]>(goal?.projectIds ?? []);
  const save = useAction(saveGoal, { success: goal ? "Goal updated" : "Goal created", onSuccess: onDone });
  const del = useAction(deleteGoal, { success: "Goal deleted", onSuccess: onDone });
  const fe = save.fieldErrors;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.run({
          id: goal?.id,
          title,
          description,
          categoryId: categoryId || null,
          horizon,
          measure,
          unit: measure === "manual" ? unit : null,
          startValue: measure === "manual" ? startValue : 0,
          currentValue: measure === "manual" ? currentValue : 0,
          targetValue: measure === "milestones" ? 100 : targetValue,
          startDate,
          deadline: deadline || null,
          priority,
          state,
          skillIds,
          projectIds,
        });
      }}
    >
      <TextInput label="Goal" value={title} onChange={(e) => setTitle(e.target.value)} error={fe.title} maxLength={160} required autoFocus placeholder="e.g. Reach B2 English" />
      <TextArea label="Why it matters" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={4000} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented label="Horizon" size="sm" value={horizon} onChange={setHorizon} options={[{ value: "short", label: "Short-term" }, { value: "long", label: "Long-term" }]} />
        <Segmented label="Priority" size="sm" value={priority} onChange={setPriority} options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} />
      </div>
      <div>
        <Segmented
          label="Measured by"
          size="sm"
          value={measure}
          onChange={(m) => {
            setMeasure(m);
            if (m === "skills" && Number(targetValue) > 100) setTargetValue("70");
          }}
          options={[
            { value: "skills", label: "Skill scores" },
            { value: "milestones", label: "Milestones" },
            { value: "manual", label: "A number I track" },
          ]}
        />
        <p className="mt-1 text-[12px] text-faint">{MEASURE_HINT[measure]}</p>
      </div>
      <ChipSelect
        label={measure === "skills" ? "Skills that measure this goal" : "Related skills"}
        values={skillIds}
        onChange={setSkillIds}
        options={data.skills.map((s) => ({ value: s.id, label: s.name }))}
        error={fe.skillIds}
        max={30}
      />
      {measure === "manual" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TextInput label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="€" maxLength={20} />
          <TextInput label="Start" type="number" inputMode="decimal" value={startValue} onChange={(e) => setStartValue(e.target.value)} error={fe.startValue} />
          <TextInput label="Current" type="number" inputMode="decimal" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} error={fe.currentValue} />
          <TextInput label="Target" type="number" inputMode="decimal" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} error={fe.targetValue} />
        </div>
      ) : measure === "skills" ? (
        <TextInput label="Target average score" type="number" inputMode="numeric" min={0} max={100} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} error={fe.targetValue} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} error={fe.startDate} />
        <TextInput label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} error={fe.deadline} hint="Optional. Needed for on-track / behind status." />
      </div>
      <ChipSelect label="Projects" values={projectIds} onChange={setProjectIds} options={data.projects.map((p) => ({ value: p.id, label: p.name }))} max={20} emptyText="No projects yet." />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">None</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        {goal ? (
          <SelectInput label="State" value={state} onChange={(e) => setState(e.target.value as GoalState)}>
            {GOAL_STATES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </SelectInput>
        ) : null}
      </div>
      {save.error && !Object.keys(fe).length ? <p className="text-[13px] text-critical">{save.error}</p> : null}
      <FormFooter>
        {goal ? <DeleteButton pending={del.pending} onDelete={() => del.run({ id: goal.id })} /> : null}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.pending}>
            {goal ? "Save" : "Create goal"}
          </Button>
        </div>
      </FormFooter>
    </form>
  );
}

export function AddGoalButton() {
  return (
    <FormModalButton title="New goal" label="New goal" icon={<Plus size={15} />} variant="primary" size="md">
      {(close) => <GoalForm onDone={close} />}
    </FormModalButton>
  );
}

export function EditGoalButton({ goal }: { goal: Goal }) {
  return (
    <FormModalButton title="Edit goal" label="Edit" icon={<Pencil size={13} />} variant="ghost">
      {(close) => <GoalForm goal={goal} onDone={close} />}
    </FormModalButton>
  );
}

export function GoalValueUpdater({ goal }: { goal: Goal }) {
  const [value, setValue] = useState(String(goal.currentValue));
  const { run, pending } = useAction(updateGoalValue, { success: "Progress updated" });
  const { readOnly } = useAppData();
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run({ id: goal.id, currentValue: Number(value) });
      }}
    >
      <TextInput label={`Current${goal.unit ? ` (${goal.unit})` : ""}`} type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="w-32" />
      <Button type="submit" size="md" loading={pending} disabled={readOnly || Number(value) === goal.currentValue}>
        Update
      </Button>
    </form>
  );
}

// ---- Milestones --------------------------------------------------------------

export function MilestoneForm({ milestone, onDone, goalId, projectId }: { milestone?: Milestone; onDone: () => void; goalId?: string; projectId?: string }) {
  const data = useAppData();
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [g, setGoal] = useState(milestone?.goalId ?? goalId ?? "");
  const [p, setProject] = useState(milestone?.projectId ?? projectId ?? "");
  const [skillId, setSkill] = useState(milestone?.skillId ?? "");
  const [dueOn, setDue] = useState(milestone?.dueOn ?? "");
  const [achievedOn, setAchieved] = useState(milestone?.achievedOn ?? "");
  const [significance, setSignificance] = useState<number>(milestone?.significance ?? 2);
  const save = useAction(saveMilestone, { success: milestone ? "Milestone updated" : "Milestone added", onSuccess: onDone });
  const del = useAction(deleteMilestone, { success: "Milestone deleted", onSuccess: onDone });
  const fe = save.fieldErrors;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.run({ id: milestone?.id, title, description, goalId: g || null, projectId: p || null, skillId: skillId || null, dueOn: dueOn || null, achievedOn: achievedOn || null, significance });
      }}
    >
      <TextInput label="Milestone" value={title} onChange={(e) => setTitle(e.target.value)} error={fe.title} maxLength={160} required autoFocus placeholder="e.g. First deployed application" />
      <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
      <Segmented label="Significance" size="sm" value={significance} onChange={setSignificance} options={[{ value: 1, label: "Minor" }, { value: 2, label: "Notable" }, { value: 3, label: "Major" }]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Due" type="date" value={dueOn} onChange={(e) => setDue(e.target.value)} error={fe.dueOn} />
        <TextInput label="Achieved on" type="date" value={achievedOn} max={data.today} onChange={(e) => setAchieved(e.target.value)} error={fe.achievedOn} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectInput label="Goal" value={g} onChange={(e) => setGoal(e.target.value)}>
          <option value="">None</option>
          {data.goals.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Project" value={p} onChange={(e) => setProject(e.target.value)}>
          <option value="">None</option>
          {data.projects.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Skill" value={skillId} onChange={(e) => setSkill(e.target.value)} hint="Achieving it counts as demonstrated skill.">
          <option value="">None</option>
          {data.skills.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </SelectInput>
      </div>
      {save.error && !Object.keys(fe).length ? <p className="text-[13px] text-critical">{save.error}</p> : null}
      <FormFooter>
        {milestone ? <DeleteButton pending={del.pending} onDelete={() => del.run({ id: milestone.id })} /> : null}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.pending}>
            {milestone ? "Save" : "Add milestone"}
          </Button>
        </div>
      </FormFooter>
    </form>
  );
}

export function AddMilestoneButton({ goalId, projectId, label = "Milestone" }: { goalId?: string; projectId?: string; label?: string }) {
  return (
    <FormModalButton title="Add milestone" label={label} icon={<Plus size={13} />} variant="ghost">
      {(close) => <MilestoneForm onDone={close} goalId={goalId} projectId={projectId} />}
    </FormModalButton>
  );
}

/** A checklist row: tick to mark achieved today (optimistic), click title to edit. */
export function MilestoneItem({ milestone, today }: { milestone: Milestone; today: string }) {
  const [done, setDone] = useState(!!milestone.achievedOn);
  const { run, pending } = useAction(toggleMilestone, { success: done ? "Milestone achieved" : "Milestone reopened" });
  const { readOnly } = useAppData();
  const overdue = !done && milestone.dueOn && milestone.dueOn < today;
  return (
    <li className="flex items-start gap-2.5 py-2">
      <button
        type="button"
        disabled={readOnly || pending}
        onClick={async () => {
          const next = !done;
          setDone(next);
          if (!(await run({ id: milestone.id, achieved: next }))) setDone(!next);
        }}
        aria-pressed={done}
        aria-label={done ? `Mark "${milestone.title}" as not achieved` : `Mark "${milestone.title}" as achieved`}
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors",
          done ? "border-accent bg-accent text-accent-fg" : "border-line-strong hover:border-accent",
        )}
      >
        {done ? <Check size={12} strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <FormModalButton title="Edit milestone" label={<span className={cn("text-left text-[13.5px] font-normal", done ? "text-faint line-through" : "text-fg")}>{milestone.title}</span>} variant="ghost" className="h-auto !justify-start !border-0 !p-0 hover:!bg-transparent">
          {(close) => <MilestoneForm milestone={milestone} onDone={close} />}
        </FormModalButton>
        <p className={cn("text-[12px]", overdue ? "text-critical" : "text-faint")}>
          {done && milestone.achievedOn ? `Achieved ${formatDate(milestone.achievedOn, { year: true })}` : done ? "Achieved" : milestone.dueOn ? `${overdue ? "Overdue · " : ""}Due ${formatDate(milestone.dueOn, { year: true })}` : "No due date"}
          {milestone.significance === 3 ? " · major" : ""}
        </p>
      </div>
    </li>
  );
}
