"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_COLORS, type CategoryColor, type Skill } from "@/lib/domain";
import { deleteCategory, deleteSkill, saveCategory, saveSkill } from "@/lib/actions/entities";
import { categoryColor } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { SelectInput, TextArea, TextInput } from "@/components/ui/fields";
import { useAppData } from "@/components/app/app-data";
import { useAction } from "@/components/app/use-action";
import { DeleteButton, FormFooter, FormModalButton } from "./form-modal";

export function SkillForm({ skill, onDone }: { skill?: Skill; onDone: () => void }) {
  const data = useAppData();
  const router = useRouter();
  const [name, setName] = useState(skill?.name ?? "");
  const [categoryId, setCategoryId] = useState(skill?.categoryId ?? data.categories[0]?.id ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [baselineScore, setBaseline] = useState(skill?.baselineScore ?? 10);
  const [targetScore, setTarget] = useState(skill?.targetScore ?? 70);
  const [trackedSince, setSince] = useState(skill?.trackedSince ?? data.today);
  const [archived, setArchived] = useState(skill?.archived ?? false);
  const save = useAction(saveSkill, { success: skill ? "Skill updated" : "Skill added", onSuccess: onDone });
  const del = useAction(deleteSkill, {
    success: "Skill deleted",
    onSuccess: () => {
      onDone();
      router.push("/skills");
    },
  });
  const fe = save.fieldErrors;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.run({ id: skill?.id, name, categoryId: categoryId || null, description, baselineScore, targetScore, trackedSince, archived });
      }}
    >
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} error={fe.name} maxLength={80} required autoFocus />
      <SelectInput label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} error={fe.categoryId}>
        <option value="">Uncategorised</option>
        {data.categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectInput>
      <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} error={fe.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ScoreSlider label="Starting level" value={baselineScore} onChange={setBaseline} error={fe.baselineScore} hint="Your honest self-assessment when you started tracking. Growth is earned above it." />
        <ScoreSlider label="Target" value={targetScore} onChange={setTarget} error={fe.targetScore} hint="Where you want to be." />
      </div>
      <TextInput label="Tracked since" type="date" value={trackedSince} max={data.today} onChange={(e) => setSince(e.target.value)} error={fe.trackedSince} />
      {skill ? (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Archived (hidden from scores and lists)
        </label>
      ) : null}
      {save.error && !Object.keys(fe).length ? <p className="text-[13px] text-critical">{save.error}</p> : null}
      <FormFooter>
        {skill ? <DeleteButton pending={del.pending} onDelete={() => del.run({ id: skill.id })} /> : null}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.pending}>
            {skill ? "Save" : "Add skill"}
          </Button>
        </div>
      </FormFooter>
    </form>
  );
}

function ScoreSlider({ label, value, onChange, error, hint }: { label: string; value: number; onChange: (v: number) => void; error?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-medium uppercase tracking-wide text-faint">{label}</span>
        <span className="tabular text-sm font-semibold">{value}</span>
      </div>
      <input type="range" min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="h-6 w-full" />
      {error ? <p className="text-[12px] text-critical">{error}</p> : hint ? <p className="text-[12px] text-faint">{hint}</p> : null}
    </div>
  );
}

export function AddSkillButton() {
  return (
    <FormModalButton title="Add skill" label="Add skill" icon={<Plus size={15} />} variant="primary" size="md">
      {(close) => <SkillForm onDone={close} />}
    </FormModalButton>
  );
}

export function EditSkillButton({ skill }: { skill: Skill }) {
  return (
    <FormModalButton title="Edit skill" label="Edit" icon={<Pencil size={14} />}>
      {(close) => <SkillForm skill={skill} onDone={close} />}
    </FormModalButton>
  );
}

export function CategoryManager() {
  return (
    <FormModalButton title="Categories" label="Categories" size="md">
      {(close) => <CategoryList onDone={close} />}
    </FormModalButton>
  );
}

function CategoryList({ onDone }: { onDone: () => void }) {
  const data = useAppData();
  const [name, setName] = useState("");
  const [color, setColor] = useState<CategoryColor>("violet");
  const add = useAction(saveCategory, { success: "Category added", onSuccess: () => setName("") });
  return (
    <div className="flex flex-col gap-5">
      <ul className="divide-y divide-line border-y border-line">
        {data.categories.map((c) => (
          <CategoryRow key={c.id} id={c.id} name={c.name} color={c.color} />
        ))}
        {data.categories.length === 0 ? <li className="py-3 text-[13px] text-faint">No categories yet.</li> : null}
      </ul>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          add.run({ name, color });
        }}
      >
        <TextInput label="New category" value={name} onChange={(e) => setName(e.target.value)} error={add.fieldErrors.name} placeholder="e.g. Frontend" maxLength={60} />
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>
            Done
          </Button>
          <Button type="submit" variant="primary" loading={add.pending} disabled={!name.trim()}>
            Add category
          </Button>
        </div>
      </form>
    </div>
  );
}

function CategoryRow({ id, name: initialName, color: initialColor }: { id: string; name: string; color: CategoryColor }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const save = useAction(saveCategory, { success: "Category saved", onSuccess: () => setEditing(false) });
  const del = useAction(deleteCategory, { success: "Category deleted — its skills are now uncategorised" });
  if (!editing) {
    return (
      <li className="flex items-center gap-2 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(initialColor) }} />
        <span className="flex-1 text-sm">{initialName}</span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-3 py-3">
      <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} error={save.fieldErrors.name} maxLength={60} />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2">
        <DeleteButton pending={del.pending} onDelete={() => del.run({ id })} />
        <Button className="ml-auto" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button variant="primary" loading={save.pending} onClick={() => save.run({ id, name, color })}>
          Save
        </Button>
      </div>
    </li>
  );
}

function ColorPicker({ value, onChange }: { value: CategoryColor; onChange: (c: CategoryColor) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-faint">Color</legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={`h-7 w-7 rounded-full border-2 ${value === c ? "border-fg" : "border-transparent"}`}
            style={{ background: categoryColor(c) }}
          />
        ))}
      </div>
    </fieldset>
  );
}
