import { useMemo, useState } from 'react';
import { Plus, BookOpen, Target, Trash2, Calculator } from 'lucide-react';
import type { Class } from '@/types';
import { useData } from '@/context/DataContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import * as data from '@/services/data';

const COLORS = [
  { value: 'blue', class: 'bg-blue-500' },
  { value: 'brand', class: 'bg-brand-500' },
  { value: 'amber', class: 'bg-amber-500' },
  { value: 'rose', class: 'bg-rose-500' },
  { value: 'violet', class: 'bg-violet-500' },
  { value: 'slate', class: 'bg-slate-500' },
];

function colorDot(c: string): string {
  return COLORS.find((x) => x.value === c)?.class ?? 'bg-slate-400';
}

export function ClassesPage() {
  const { classes, assignments, loading, reload } = useData();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Class | null>(null);
  const [calcClass, setCalcClass] = useState<Class | null>(null);

  const statsByClass = useMemo(() => {
    const map = new Map<string, { open: number; missing: number }>();
    for (const c of classes) map.set(c.id, { open: 0, missing: 0 });
    for (const a of assignments) {
      if (!a.class_id) continue;
      const s = map.get(a.class_id);
      if (!s) continue;
      if (!a.completed) s.open += 1;
      if (a.is_missing) s.missing += 1;
    }
    return map;
  }, [classes, assignments]);

  if (loading) {
    return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Classes</h1>
          <p className="mt-1 text-sm text-slate-500">{classes.length} {classes.length === 1 ? 'class' : 'classes'} · track grades and goals</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Add class
        </Button>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No classes yet"
          description="Add your classes to organize assignments, track grades, and set improvement goals."
          action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add your first class</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => {
            const s = statsByClass.get(c.id) ?? { open: 0, missing: 0 };
            const gap = c.current_grade != null && c.goal_grade != null ? c.goal_grade - c.current_grade : null;
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`h-10 w-10 rounded-xl ${colorDot(c.color)}`} />
                    <div>
                      <h3 className="font-display font-semibold text-slate-900">{c.name}</h3>
                      {c.teacher && <p className="text-sm text-slate-500">{c.teacher}</p>}
                    </div>
                  </div>
                  <button onClick={async () => { await data.deleteClass(c.id); await reload(); }} className="rounded-md p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Current grade</div>
                    <div className="font-display text-xl font-bold text-slate-900">
                      {c.current_grade != null ? `${c.current_grade}%` : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">Goal</div>
                    <div className="font-display text-xl font-bold text-brand-600">
                      {c.goal_grade != null ? `${c.goal_grade}%` : '—'}
                    </div>
                  </div>
                </div>

                {gap != null && (
                  <div className={`mt-3 flex items-center gap-1.5 text-sm ${gap > 0 ? 'text-amber-600' : 'text-brand-600'}`}>
                    <Target className="h-4 w-4" />
                    {gap > 0 ? `${gap.toFixed(1)} points to your goal` : 'Goal reached!'}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-500">{s.open} open · {s.missing} missing</span>
                  <div className="flex gap-2">
                    <button onClick={() => setCalcClass(c)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <Calculator className="h-3.5 w-3.5" /> Calculator
                    </button>
                    <button onClick={() => { setEditing(c); setFormOpen(true); }} className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">
                      Edit
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ClassForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} existing={editing} />
      {calcClass && <GradeCalculatorModal cls={calcClass} onClose={() => setCalcClass(null)} onSaved={reload} />}
    </div>
  );
}

function ClassForm({ open, onClose, onSaved, existing }: { open: boolean; onClose: () => void; onSaved: () => void; existing: Class | null }) {
  const [name, setName] = useState(existing?.name ?? '');
  const [teacher, setTeacher] = useState(existing?.teacher ?? '');
  const [color, setColor] = useState(existing?.color ?? 'blue');
  const [currentGrade, setCurrentGrade] = useState(existing?.current_grade?.toString() ?? '');
  const [goalGrade, setGoalGrade] = useState(existing?.goal_grade?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setError('Please enter a class name.'); return; }
    setBusy(true);
    setError(null);
    try {
      const payload: Partial<Class> = {
        name: name.trim(),
        teacher: teacher.trim(),
        color,
        current_grade: currentGrade ? Number(currentGrade) : null,
        goal_grade: goalGrade ? Number(goalGrade) : null,
      };
      if (existing) await data.updateClass(existing.id, payload);
      else await data.createClass(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit class' : 'New class'}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>{existing ? 'Save' : 'Add class'}</Button></div>}>
      <div className="space-y-4">
        <Field label="Class name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="AP Biology" /></Field>
        <Field label="Teacher"><Input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Mr. Chen" /></Field>
        <Field label="Color">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c.value} type="button" onClick={() => setColor(c.value)}
                className={`h-8 w-8 rounded-lg ${c.class} ${color === c.value ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`} aria-label={c.value} />
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current grade (%)"><Input type="number" value={currentGrade} onChange={(e) => setCurrentGrade(e.target.value)} placeholder="91" /></Field>
          <Field label="Goal grade (%)"><Input type="number" value={goalGrade} onChange={(e) => setGoalGrade(e.target.value)} placeholder="95" /></Field>
        </div>
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">{error}</div>}
      </div>
    </Modal>
  );
}

function GradeCalculatorModal({ cls, onClose, onSaved }: { cls: Class; onClose: () => void; onSaved: () => void }) {
  const [score, setScore] = useState('90');
  const [weight, setWeight] = useState('20');
  const current = cls.current_grade ?? 0;
  const s = Number(score);
  const w = Number(weight);
  const projected = w > 0 ? (current * (100 - w) + s * w) / 100 : current;
  const delta = projected - current;

  return (
    <Modal open onClose={onClose} title={`Grade calculator — ${cls.name}`}
      footer={<Button onClick={onClose}>Done</Button>}>
      <p className="text-sm text-slate-600">Test what a future assignment would do to your grade. This is an estimate assuming the weight you enter.</p>
      <div className="mt-4 space-y-4">
        <Field label="Hypothetical score (%)"><Input type="number" value={score} onChange={(e) => setScore(e.target.value)} /></Field>
        <Field label="Assignment weight (% of grade)" hint="How much this assignment counts toward your total grade."><Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="text-xs text-slate-500">Current grade</div>
          <div className="font-display text-2xl font-bold text-slate-900">{current.toFixed(1)}%</div>
          <div className="mt-3 text-xs text-slate-500">Projected grade</div>
          <div className="font-display text-2xl font-bold text-brand-600">{projected.toFixed(1)}%</div>
          <div className={`mt-1 text-sm ${delta >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)} points
          </div>
        </div>
      </div>
    </Modal>
  );
}
