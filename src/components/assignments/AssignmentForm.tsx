import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Assignment, Category, Class } from '@/types';
import { CATEGORIES, CATEGORY_LIST } from '@/lib/categories';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import * as data from '@/services/data';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function AssignmentForm({
  open,
  onClose,
  onSaved,
  classes,
  existing,
  defaultClassId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  classes: Class[];
  existing?: Assignment | null;
  defaultClassId?: string | null;
}) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [classId, setClassId] = useState(existing?.class_id ?? defaultClassId ?? '');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'preparatory');
  const [dueDate, setDueDate] = useState(toLocalInput(existing?.due_date ?? null));
  const [minutes, setMinutes] = useState(existing?.estimated_minutes ?? CATEGORIES.preparatory.defaultMinutes);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchedMinutes, setTouchedMinutes] = useState(false);

  function onCategoryChange(next: Category) {
    setCategory(next);
    if (!touchedMinutes && !existing) setMinutes(CATEGORIES[next].defaultMinutes);
  }

  async function save() {
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: Partial<Assignment> = {
        title: title.trim(),
        class_id: classId || null,
        category,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        estimated_minutes: Number(minutes) || 30,
        description: description.trim(),
      };
      if (existing) {
        await data.updateAssignment(existing.id, payload);
      } else {
        await data.createAssignment({ ...payload, points_value: CATEGORIES[category].defaultPoints });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit assignment' : 'New assignment'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? 'Save changes' : 'Add assignment'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cell Lab Report" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Class">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">No class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => onCategoryChange(e.target.value as Category)}>
              {CATEGORY_LIST.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Due date">
            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="Estimated effort (min)">
            <Input
              type="number"
              min={5}
              step={5}
              value={minutes}
              onChange={(e) => {
                setTouchedMinutes(true);
                setMinutes(Number(e.target.value));
              }}
            />
          </Field>
        </div>
        <Field label="Notes" hint="Optional details or requirements.">
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Include lab data table and conclusion."
          />
        </Field>
        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
