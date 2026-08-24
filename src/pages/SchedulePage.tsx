import { useMemo, useState } from 'react';
import { Plus, Clock, Trash2 } from 'lucide-react';
import type { Commitment, CommitmentKind } from '@/types';
import { useData } from '@/context/DataContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { DAY_NAMES, formatTime } from '@/lib/format';
import { availableMinutesToday } from '@/lib/planner';
import { formatMinutes } from '@/lib/format';
import * as data from '@/services/data';

const KINDS: { value: CommitmentKind; label: string }[] = [
  { value: 'school', label: 'School' },
  { value: 'sport', label: 'Sport' },
  { value: 'club', label: 'Club' },
  { value: 'job', label: 'Job' },
  { value: 'family', label: 'Family' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'study', label: 'Study block' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'other', label: 'Other' },
];

export function SchedulePage() {
  const { commitments, loading, reload } = useData();
  const [open, setOpen] = useState(false);

  const byDay = useMemo(() => {
    const map = new Map<number, Commitment[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    for (const c of commitments) {
      const list = map.get(c.day_of_week);
      if (list) list.push(c);
    }
    for (const [, list] of map) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [commitments]);

  const freeToday = useMemo(() => availableMinutesToday(commitments), [commitments]);

  if (loading) {
    return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Your schedule</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add recurring commitments so your daily plan fits real life. About {formatMinutes(freeToday)} free today.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add commitment</Button>
      </div>

      {commitments.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-6 w-6" />}
          title="No commitments yet"
          description="Add your school hours, sports, clubs, and other activities. The planner uses these to build a realistic schedule."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add your first commitment</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DAY_NAMES.map((day, dow) => {
            const list = byDay.get(dow) ?? [];
            return (
              <Card key={day}>
                <CardHeader title={day} subtitle={list.length === 0 ? 'Free' : `${list.length} ${list.length === 1 ? 'item' : 'items'}`} />
                {list.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">Nothing scheduled</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {list.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">{c.title}</div>
                          <div className="text-xs text-slate-500">
                            {KINDS.find((k) => k.value === c.kind)?.label ?? c.kind} · {formatTime(c.start_time)}–{formatTime(c.end_time)}
                          </div>
                        </div>
                        <button onClick={async () => { await data.deleteCommitment(c.id); await reload(); }}
                          className="rounded-md p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CommitmentForm open={open} onClose={() => setOpen(false)} onSaved={reload} />
    </div>
  );
}

function CommitmentForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<CommitmentKind>('school');
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('07:30');
  const [end, setEnd] = useState('14:30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) { setError('Please enter a title.'); return; }
    setBusy(true);
    setError(null);
    try {
      await data.createCommitment({ title: title.trim(), kind, day_of_week: day, start_time: start, end_time: end });
      onSaved();
      onClose();
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add commitment"
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={busy}>Add</Button></div>}>
      <div className="space-y-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Soccer practice" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as CommitmentKind)}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </Select>
          </Field>
          <Field label="Day">
            <Select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start time"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="End time"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">{error}</div>}
      </div>
    </Modal>
  );
}
