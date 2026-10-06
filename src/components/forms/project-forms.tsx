"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECT_STATUSES, type Project, type ProjectStatus, type ProjectTrack } from "@/lib/domain";
import { deleteProject, saveProject, updateTrackProgress } from "@/lib/actions/entities";
import { Button } from "@/components/ui/button";
import { ChipSelect, SelectInput, TextArea, TextInput } from "@/components/ui/fields";
import { useAppData } from "@/components/app/app-data";
import { useAction } from "@/components/app/use-action";
import { DeleteButton, FormFooter, FormModalButton } from "./form-modal";

const STATUS_LABEL: Record<ProjectStatus, string> = { planning: "Planning", active: "Active", paused: "Paused", completed: "Completed", abandoned: "Abandoned" };

export function ProjectForm({ project, onDone }: { project?: Project; onDone: () => void }) {
  const data = useAppData();
  const router = useRouter();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [startDate, setStart] = useState(project?.startDate ?? data.today);
  const [targetDate, setTarget] = useState(project?.targetDate ?? "");
  const [completedOn, setCompleted] = useState(project?.completedOn ?? "");
  const [manualProgress, setManual] = useState(project?.manualProgress ?? 0);
  const [tracks, setTracks] = useState<{ name: string; progress: number }[]>(
    project?.tracks.map((t) => ({ name: t.name, progress: t.progress })) ?? [],
  );
  const [skillIds, setSkillIds] = useState<string[]>(project?.skillIds ?? []);
  const [links, setLinks] = useState((project?.links ?? []).join("\n"));
  const [output, setOutput] = useState(project?.output ?? "");
  const [notes, setNotes] = useState(project?.notes ?? "");
  const save = useAction(saveProject, { success: project ? "Project updated" : "Project created", onSuccess: onDone });
  const del = useAction(deleteProject, {
    success: "Project deleted",
    onSuccess: () => {
      onDone();
      router.push("/projects");
    },
  });
  const fe = save.fieldErrors;
  const linkError = Object.entries(fe).find(([k]) => k.startsWith("links"))?.[1];

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.run({
          id: project?.id,
          name,
          description,
          status,
          manualProgress,
          startDate: startDate || null,
          targetDate: targetDate || null,
          completedOn: status === "completed" ? completedOn || null : null,
          output,
          notes,
          links: links.split(/\s+/).map((l) => l.trim()).filter(Boolean),
          skillIds,
          tracks: tracks.filter((t) => t.name.trim()),
        });
      }}
    >
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} error={fe.name} maxLength={120} required autoFocus />
      <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={4000} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} hint={status === "completed" ? "Completed projects count as real-world output for linked skills." : undefined}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </SelectInput>
        {status === "completed" ? (
          <TextInput label="Completed on" type="date" value={completedOn} max={data.today} onChange={(e) => setCompleted(e.target.value)} hint="Defaults to today." />
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Start" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
        <TextInput label="Target date" type="date" value={targetDate} onChange={(e) => setTarget(e.target.value)} error={fe.targetDate} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-faint">Work streams</legend>
        <p className="-mt-1 text-[12px] text-faint">e.g. Planning, Backend, AI, Frontend, Deployment. Project progress = their average.</p>
        {tracks.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={t.name}
              onChange={(e) => setTracks(tracks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              placeholder="Stream"
              maxLength={60}
              aria-label="Stream name"
              className="h-9 w-32 min-w-0 rounded-md border border-line-strong bg-panel-2 px-2 text-[16px] sm:w-40 sm:text-sm"
            />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={t.progress}
              onChange={(e) => setTracks(tracks.map((x, j) => (j === i ? { ...x, progress: Number(e.target.value) } : x)))}
              aria-label={`${t.name || "Stream"} progress`}
              className="min-w-0 flex-1"
            />
            <span className="tabular w-9 text-right text-[13px] text-muted">{t.progress}%</span>
            <button type="button" onClick={() => setTracks(tracks.filter((_, j) => j !== i))} className="rounded p-1 text-faint hover:text-fg" aria-label="Remove stream">
              <X size={15} />
            </button>
          </div>
        ))}
        {tracks.length < 12 ? (
          <Button size="sm" variant="ghost" className="self-start" onClick={() => setTracks([...tracks, { name: "", progress: 0 }])}>
            <Plus size={14} /> Add stream
          </Button>
        ) : null}
        {tracks.length === 0 ? (
          <label className="flex items-center gap-3 text-[13px] text-muted">
            Overall progress
            <input type="range" min={0} max={100} step={5} value={manualProgress} onChange={(e) => setManual(Number(e.target.value))} className="flex-1" />
            <span className="tabular w-9 text-right">{manualProgress}%</span>
          </label>
        ) : null}
      </fieldset>

      <ChipSelect label="Skills developed" values={skillIds} onChange={setSkillIds} options={data.skills.map((s) => ({ value: s.id, label: s.name }))} max={30} />
      <TextArea label="Links" value={links} onChange={(e) => setLinks(e.target.value)} rows={2} placeholder="One URL per line" error={linkError} />
      <TextArea label="Output" value={output} onChange={(e) => setOutput(e.target.value)} rows={2} maxLength={4000} hint="What exists because of this project?" />
      <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={8000} />
      {save.error && !Object.keys(fe).length ? <p className="text-[13px] text-critical">{save.error}</p> : null}
      <FormFooter>
        {project ? <DeleteButton pending={del.pending} onDelete={() => del.run({ id: project.id })} /> : null}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.pending}>
            {project ? "Save" : "Create project"}
          </Button>
        </div>
      </FormFooter>
    </form>
  );
}

export function AddProjectButton() {
  return (
    <FormModalButton title="New project" label="New project" icon={<Plus size={15} />} variant="primary" size="md">
      {(close) => <ProjectForm onDone={close} />}
    </FormModalButton>
  );
}

export function EditProjectButton({ project }: { project: Project }) {
  return (
    <FormModalButton title="Edit project" label="Edit" icon={<Pencil size={13} />}>
      {(close) => <ProjectForm project={project} onDone={close} />}
    </FormModalButton>
  );
}

/** Inline progress slider for one work stream; saves when released. */
export function TrackSlider({ track }: { track: ProjectTrack }) {
  const [value, setValue] = useState(track.progress);
  const { run, pending } = useAction(updateTrackProgress);
  const { readOnly } = useAppData();
  const commit = () => {
    if (value !== track.progress) run({ id: track.id, progress: value });
  };
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_40px] items-center gap-3 sm:grid-cols-[120px_minmax(0,1fr)_44px]">
      <span className="truncate text-[13px] text-muted">{track.name}</span>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${value}%`, opacity: pending ? 0.6 : 1 }} />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={readOnly}
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          aria-label={`${track.name} progress`}
          className="absolute inset-0 w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
      </div>
      <span className="tabular text-right text-[13px]">{value}%</span>
    </div>
  );
}
