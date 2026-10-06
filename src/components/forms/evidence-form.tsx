"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { EVIDENCE_KINDS, type Evidence, type EvidenceKind } from "@/lib/domain";
import { deleteEvidence, saveEvidence } from "@/lib/actions/entities";
import { EVIDENCE_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ChipSelect, SelectInput, TextArea, TextInput } from "@/components/ui/fields";
import { useAppData } from "@/components/app/app-data";
import { useAction } from "@/components/app/use-action";
import { DeleteButton, FormFooter, FormModalButton } from "./form-modal";

const KIND_HINT: Record<EvidenceKind, string> = {
  course: "Demonstrated · weight 1",
  writeup: "Demonstrated · weight 1",
  implementation: "Demonstrated · weight 1.5",
  assessment: "Demonstrated · weight 2 × score/100",
  milestone: "Demonstrated · weight 2",
  repository: "Real-world output · weight 2",
  project: "Real-world output · weight 3",
  deployment: "Real-world output · weight 3",
  real_world: "Real-world output · weight 4",
};

export function EvidenceForm({ evidence, onDone, presetSkillId, presetProjectId }: { evidence?: Evidence; onDone: () => void; presetSkillId?: string; presetProjectId?: string }) {
  const data = useAppData();
  const [title, setTitle] = useState(evidence?.title ?? "");
  const [kind, setKind] = useState<EvidenceKind>(evidence?.kind ?? "implementation");
  const [url, setUrl] = useState(evidence?.url ?? "");
  const [description, setDescription] = useState(evidence?.description ?? "");
  const [assessmentScore, setScore] = useState<string>(evidence?.assessmentScore?.toString() ?? "");
  const [occurredOn, setDate] = useState(evidence?.occurredOn ?? data.today);
  const [projectId, setProjectId] = useState(evidence?.projectId ?? presetProjectId ?? "");
  const [milestoneId, setMilestoneId] = useState(evidence?.milestoneId ?? "");
  const [skillIds, setSkillIds] = useState<string[]>(evidence?.skillIds ?? (presetSkillId ? [presetSkillId] : []));
  const save = useAction(saveEvidence, { success: evidence ? "Evidence updated" : "Evidence added", onSuccess: onDone });
  const del = useAction(deleteEvidence, { success: "Evidence deleted", onSuccess: onDone });
  const fe = save.fieldErrors;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.run({
          id: evidence?.id,
          title,
          kind,
          url,
          description,
          assessmentScore: kind === "assessment" ? assessmentScore : null,
          occurredOn,
          projectId: projectId || null,
          activityId: evidence?.activityId ?? null,
          milestoneId: milestoneId || null,
          skillIds,
        });
      }}
    >
      <TextInput label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={fe.title} maxLength={160} required autoFocus placeholder="e.g. Deployed Task API to Fly.io" />
      <SelectInput label="Kind" value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)} hint={KIND_HINT[kind]}>
        {EVIDENCE_KINDS.map((k) => (
          <option key={k} value={k}>
            {EVIDENCE_LABEL[k]}
          </option>
        ))}
      </SelectInput>
      {kind === "assessment" ? (
        <TextInput label="Score (0–100)" type="number" inputMode="decimal" min={0} max={100} value={assessmentScore} onChange={(e) => setScore(e.target.value)} error={fe.assessmentScore} />
      ) : null}
      <TextInput label="Link" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} error={fe.url} placeholder="https://" />
      <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
      <TextInput label="Date" type="date" value={occurredOn} max={data.today} onChange={(e) => setDate(e.target.value)} error={fe.occurredOn} />
      <ChipSelect label="Skills it demonstrates" values={skillIds} onChange={setSkillIds} options={data.skills.map((s) => ({ value: s.id, label: s.name }))} max={20} error={fe.skillIds} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">None</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Milestone" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
          <option value="">None</option>
          {data.milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </SelectInput>
      </div>
      {save.error && !Object.keys(fe).length ? <p className="text-[13px] text-critical">{save.error}</p> : null}
      <FormFooter>
        {evidence ? <DeleteButton pending={del.pending} onDelete={() => del.run({ id: evidence.id })} /> : null}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.pending}>
            {evidence ? "Save" : "Add evidence"}
          </Button>
        </div>
      </FormFooter>
    </form>
  );
}

export function AddEvidenceButton({ skillId, projectId, label = "Add evidence", variant = "secondary" }: { skillId?: string; projectId?: string; label?: string; variant?: "secondary" | "primary" | "ghost" }) {
  return (
    <FormModalButton title="Add evidence" label={label} icon={<Plus size={14} />} variant={variant}>
      {(close) => <EvidenceForm onDone={close} presetSkillId={skillId} presetProjectId={projectId} />}
    </FormModalButton>
  );
}

export function EditEvidenceButton({ evidence }: { evidence: Evidence }) {
  return (
    <FormModalButton title="Edit evidence" label="Edit" variant="ghost">
      {(close) => <EvidenceForm evidence={evidence} onDone={close} />}
    </FormModalButton>
  );
}
