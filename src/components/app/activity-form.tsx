"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays } from "@/lib/dates";
import { ACTIVITY_MODES, ACTIVITY_TYPES, DEFAULT_MODE, EVIDENCE_KINDS, OUTCOMES, type Activity, type ActivityMode, type ActivityType, type EvidenceKind, type Outcome } from "@/lib/domain";
import { saveActivity } from "@/lib/actions/entities";
import { EVIDENCE_LABEL, MODE_HINT, MODE_LABEL, OUTCOME_LABEL, TYPE_LABEL, fmtMinutes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChipSelect, Segmented, SelectInput, TextArea, TextInput } from "@/components/ui/fields";
import { useAppData } from "./app-data";
import { useAction } from "./use-action";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const PREFS_KEY = "ppd:activity-prefs";

interface Prefs {
  type: ActivityType;
  mode: ActivityMode;
  durationMinutes: number;
}

function loadPrefs(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function ActivityForm({ activity, onDone, presetSkillId, presetProjectId }: { activity?: Activity; onDone: () => void; presetSkillId?: string; presetProjectId?: string }) {
  const data = useAppData();
  const editing = !!activity;
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(activity?.title ?? "");
  const [skillIds, setSkillIds] = useState<string[]>(activity?.skillIds ?? (presetSkillId ? [presetSkillId] : []));
  const [durationMinutes, setDuration] = useState(activity?.durationMinutes ?? 60);
  const [type, setType] = useState<ActivityType>(activity?.type ?? "coding");
  const [mode, setMode] = useState<ActivityMode>(activity?.mode ?? DEFAULT_MODE.coding);
  const [difficulty, setDifficulty] = useState<number>(activity?.difficulty ?? 3);
  const [outcome, setOutcome] = useState<Outcome>(activity?.outcome ?? "partial");
  const [occurredOn, setDate] = useState(activity?.occurredOn ?? data.today);
  const [projectId, setProjectId] = useState(activity?.projectId ?? presetProjectId ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [notes, setNotes] = useState(activity?.notes ?? "");
  const [more, setMore] = useState(editing || !!presetProjectId);
  const [evTitle, setEvTitle] = useState("");
  const [evKind, setEvKind] = useState<EvidenceKind>("implementation");
  const [evUrl, setEvUrl] = useState("");

  // Restore last-used type/mode/duration for new entries (per-device convenience only).
  useEffect(() => {
    if (editing) return;
    const p = loadPrefs();
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    if (p.type && ACTIVITY_TYPES.includes(p.type)) setType(p.type);
    if (p.mode && ACTIVITY_MODES.includes(p.mode)) setMode(p.mode);
    if (p.durationMinutes && p.durationMinutes > 0) setDuration(p.durationMinutes);
    /* eslint-enable react-hooks/set-state-in-effect */
    titleRef.current?.focus();
  }, [editing]);

  const { run, pending, fieldErrors, error } = useAction(saveActivity, {
    success: editing ? "Activity updated" : "Activity logged",
    onSuccess: () => {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ type, mode, durationMinutes }));
      } catch {}
      onDone();
    },
  });

  const skillOptions = useMemo(() => {
    const cat = new Map(data.categories.map((c) => [c.id, c.name]));
    return [...data.skills]
      .sort((a, b) => b.recent - a.recent || a.name.localeCompare(b.name))
      .map((s) => ({ value: s.id, label: s.name, group: s.categoryId ? cat.get(s.categoryId) : undefined }));
  }, [data.skills, data.categories]);

  const submit = () =>
    run({
      id: activity?.id,
      title,
      skillIds,
      durationMinutes,
      type,
      mode,
      difficulty,
      outcome,
      occurredOn,
      projectId: projectId || null,
      description,
      notes,
      evidence: evTitle.trim() ? { title: evTitle, kind: evKind, url: evUrl } : null,
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
      }}
      className="flex flex-col gap-4"
    >
      <TextInput
        ref={titleRef}
        label="What did you do?"
        placeholder="e.g. Built JWT refresh flow"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={fieldErrors.title}
        maxLength={160}
        autoComplete="off"
        required
      />

      <ChipSelect
        label="Skills"
        values={skillIds}
        options={skillOptions}
        onChange={setSkillIds}
        max={10}
        collapseAfter={10}
        error={fieldErrors.skillIds}
        emptyText="Add skills on the Skills page to attribute progress."
      />

      <fieldset>
        <legend className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-faint">Duration</legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={durationMinutes === m}
              onClick={() => setDuration(m)}
              className={`rounded-md border px-2.5 py-1.5 text-sm tabular transition-colors ${durationMinutes === m ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-muted hover:bg-hover hover:text-fg"}`}
            >
              {fmtMinutes(m)}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-[13px] text-faint">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              value={durationMinutes}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="h-9 w-20 rounded-md border border-line-strong bg-panel-2 px-2 text-[16px] text-fg sm:text-sm"
              aria-label="Duration in minutes"
            />
            min
          </label>
        </div>
        {fieldErrors.durationMinutes ? <p className="mt-1 text-[12px] text-critical">{fieldErrors.durationMinutes}</p> : null}
      </fieldset>

      <Segmented
        label="Type"
        size="sm"
        value={type}
        onChange={(t) => {
          setType(t);
          setMode(DEFAULT_MODE[t]);
        }}
        options={ACTIVITY_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
      />

      <div>
        <Segmented label="Kind of work" size="sm" value={mode} onChange={setMode} options={ACTIVITY_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
        <p className="mt-1 text-[12px] text-faint">{MODE_HINT[mode]}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented
          label="Difficulty"
          size="sm"
          value={difficulty}
          onChange={setDifficulty}
          options={[1, 2, 3, 4, 5].map((d) => ({ value: d, label: String(d), title: ["Trivial", "Easy", "Normal", "Hard", "Very hard"][d - 1] }))}
        />
        <Segmented label="Outcome" size="sm" value={outcome} onChange={setOutcome} options={OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))} />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-faint">Date</legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { label: "Today", value: data.today },
            { label: "Yesterday", value: addDays(data.today, -1) },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={occurredOn === o.value}
              onClick={() => setDate(o.value)}
              className={`rounded-md border px-2.5 py-1.5 text-sm transition-colors ${occurredOn === o.value ? "border-accent bg-accent-soft text-fg" : "border-line-strong text-muted hover:bg-hover hover:text-fg"}`}
            >
              {o.label}
            </button>
          ))}
          <input
            type="date"
            value={occurredOn}
            max={addDays(data.today, 1)}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 rounded-md border border-line-strong bg-panel-2 px-2 text-[16px] text-fg sm:text-sm"
            aria-label="Date"
          />
        </div>
        {fieldErrors.occurredOn ? <p className="mt-1 text-[12px] text-critical">{fieldErrors.occurredOn}</p> : null}
      </fieldset>

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        aria-expanded={more}
        className="flex items-center gap-1 self-start text-[13px] text-muted hover:text-fg"
      >
        <ChevronDown size={14} className={`transition-transform ${more ? "rotate-180" : ""}`} />
        Project, notes & evidence
      </button>

      {more ? (
        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <SelectInput label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} error={fieldErrors.projectId}>
            <option value="">None</option>
            {data.projects
              .filter((p) => p.status !== "abandoned" || p.id === projectId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </SelectInput>
          <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={2} error={fieldErrors.description} />
          <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={2} error={fieldErrors.notes} />
          {!editing ? (
            <fieldset className="flex flex-col gap-3 rounded-md border border-line p-3">
              <legend className="px-1 text-[12px] font-medium uppercase tracking-wide text-faint">Evidence (optional)</legend>
              <p className="-mt-1 text-[12px] text-faint">Proof of what you produced — a repo, deploy, write-up. Evidence carries more weight than time.</p>
              <TextInput label="Evidence title" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="e.g. PR #42 merged" error={fieldErrors["evidence.title"]} />
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectInput label="Kind" value={evKind} onChange={(e) => setEvKind(e.target.value as EvidenceKind)}>
                  {EVIDENCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {EVIDENCE_LABEL[k]}
                    </option>
                  ))}
                </SelectInput>
                <TextInput label="Link" type="url" inputMode="url" value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="https://" error={fieldErrors["evidence.url"]} />
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {error && !Object.keys(fieldErrors).length ? <p className="text-[13px] text-critical">{error}</p> : null}

      <div className="sticky -bottom-4 -mx-4 -mb-4 flex items-center justify-between gap-2 border-t border-line bg-panel px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-5 sm:px-5">
        <span className="hidden text-[12px] text-faint sm:inline">⌘/Ctrl + Enter to save</span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={pending} disabled={data.readOnly}>
            {editing ? "Save changes" : "Log activity"}
          </Button>
        </div>
      </div>
    </form>
  );
}
