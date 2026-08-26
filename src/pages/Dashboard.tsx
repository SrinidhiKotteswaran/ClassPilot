import { useMemo, useState } from 'react';
import { Trophy, Flame, ListChecks, AlertTriangle, Sparkles, LifeBuoy, Clock, ArrowRight, Heart, Droplets, Footprints, Users } from 'lucide-react';
import type { Route } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { greeting, motivation, formatMinutes, formatDue, isOverdue } from '@/lib/format';
import { rankAssignments, priorityLabel } from '@/lib/priority';
import { availableMinutesToday, buildTodayPlan } from '@/lib/planner';
import { CATEGORIES } from '@/lib/categories';

function Stat({ icon, value, label, tone }: { icon: React.ReactNode; value: React.ReactNode; label: string; tone: string }) {
  return <Card className="p-4"><div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>{icon}</div><div className="font-display text-2xl font-bold text-slate-900">{value}</div><div className="text-sm text-slate-500">{label}</div></Card>;
}

function isToday(dateValue: string | null): boolean {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function isFuture(dateValue: string | null): boolean {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date.getTime() >= todayStart.getTime() + 24 * 60 * 60 * 1000;
}

export function Dashboard({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { profile, session } = useAuth();
  const { classes, assignments, commitments, loading, toggleComplete } = useData();
  const [emergency, setEmergency] = useState(false);
  const [encouragementIndex, setEncouragementIndex] = useState(0);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const minutesAvailable = useMemo(() => availableMinutesToday(commitments), [commitments]);
  const ranked = useMemo(() => rankAssignments(assignments, classes), [assignments, classes]);
  const todayAssignments = useMemo(() => ranked.filter(({ assignment }) => isToday(assignment.due_date)), [ranked]);
  const plan = useMemo(() => buildTodayPlan(todayAssignments.map(({ assignment }) => assignment), classes, minutesAvailable), [todayAssignments, classes, minutesAvailable]);
  const missing = useMemo(() => ranked.filter(({ assignment }) => {
    if (assignment.completed) return false;
    if (isOverdue(assignment.due_date)) return true;
    if (!assignment.is_missing) return false;
    return !assignment.due_date || new Date(assignment.due_date).getTime() <= Date.now();
  }), [ranked]);
  const dueToday = useMemo(() => assignments.filter((assignment) => !assignment.completed && isToday(assignment.due_date)).length, [assignments]);
  const upcoming = useMemo(() => ranked.filter(({ assignment }) => isFuture(assignment.due_date)).slice(0, 7), [ranked]);
  if (loading) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>;
  const top = ranked[0];
  const authName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name;
  const storedName = typeof authName === 'string' && authName.trim() ? authName.trim() : profile?.username?.trim() || '';
  const firstName = /^srinidhikotteswaran\d+$/i.test(storedName) ? 'Srinidhi' : storedName.split(/\s+/)[0] || 'there';
  const streak = profile?.streak_count ?? 0;
  const streakLabel = streak === 1 ? '1 day' : `${streak} days`;
  const openOverwhelmed = () => {
    setEncouragementIndex((current) => (current + 1) % ENCOURAGEMENTS.length);
    setEmergency(true);
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-2xl font-bold text-slate-900">{greeting()}, {firstName}! {greeting() === 'Good morning' ? '☀️' : greeting() === 'Good afternoon' ? '🌤️' : '🌙'}</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">{motivation()}</p></div><Button variant="secondary" onClick={openOverwhelmed}><LifeBuoy className="h-4 w-4 text-rose-500" />I'm overwhelmed</Button></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat icon={<Trophy className="h-5 w-5" />} value={profile?.compass_points ?? 0} label="Compass Points" tone="bg-amber-50 text-amber-600" /><Stat icon={<Flame className="h-5 w-5" />} value={streakLabel} label="Stress-free streak" tone="bg-orange-50 text-orange-500" /><Stat icon={<ListChecks className="h-5 w-5" />} value={dueToday} label="Due today" tone="bg-sky-50 text-sky-600" /><Stat icon={<AlertTriangle className="h-5 w-5" />} value={missing.length} label="Missing / overdue" tone="bg-rose-50 text-rose-600" /></div>
    {top && <Card className="overflow-hidden"><div className="flex items-start gap-3 bg-brand-50/60 px-5 py-4"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" /><div><div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Recommended next</div><div className="mt-0.5 font-display font-semibold text-slate-900">{top.assignment.title}</div><p className="mt-1 text-sm text-slate-600">{top.reasons[0] ?? 'A good place to start.'}</p></div></div></Card>}
    <div className="grid gap-6 lg:grid-cols-5"><div className="lg:col-span-3"><Card><CardHeader title="Today's plan" subtitle={`Fits about ${formatMinutes(plan.totalMinutes)} of ${formatMinutes(minutesAvailable)} free time`} />{plan.blocks.length === 0 ? <div className="px-5 py-10 text-center text-sm text-slate-500">Nothing due today. You're clear for now.</div> : <ul className="divide-y divide-slate-100">{plan.blocks.map(({ assignment, reasons, score, fits }) => { const meta = CATEGORIES[assignment.category]; const pr = priorityLabel(score, assignment); return <li key={assignment.id} className="flex items-start gap-3 px-5 py-3"><button onClick={() => toggleComplete(assignment)} className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 transition-colors hover:border-brand-500" aria-label="Mark complete" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-medium text-slate-900">{assignment.title}</span>{pr.label && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${pr.className}`}>{pr.label}</span>}</div><p className="mt-0.5 text-xs text-slate-500">{reasons[0] ?? meta.label} · {formatMinutes(assignment.estimated_minutes)}{!fits && ' · beyond today’s free time'}</p></div><span className="shrink-0 text-xs text-slate-400">{formatDue(assignment.due_date)}</span></li>; })}</ul>}</Card></div>
      <div className="space-y-6 lg:col-span-2">{missing.length > 0 && <Card><CardHeader title="Recover missing work" subtitle="Often the fastest grade boost" /><ul className="divide-y divide-slate-100">{missing.slice(0, 4).map(({ assignment }) => <li key={assignment.id} className="flex items-center gap-3 px-5 py-3"><button onClick={() => toggleComplete(assignment)} className="h-5 w-5 shrink-0 rounded-full border-2 border-rose-300 hover:border-rose-500" aria-label="Mark complete" /><span className="min-w-0 flex-1 truncate text-sm text-slate-800">{assignment.title}</span><span className="shrink-0 text-xs font-medium text-rose-600">{classById.get(assignment.class_id ?? '')?.name ?? 'No class'}</span></li>)}</ul></Card>}
        <Card><CardHeader title="Upcoming" action={<button onClick={() => onNavigate('upcoming')} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">View <ArrowRight className="h-3.5 w-3.5" /></button>} />{upcoming.length === 0 ? <div className="px-5 py-8 text-center text-sm text-slate-500">No upcoming work.</div> : <ul className="divide-y divide-slate-100">{upcoming.map(({ assignment }) => <li key={assignment.id} className="flex items-center gap-3 px-5 py-2.5"><Clock className="h-4 w-4 shrink-0 text-slate-300" /><span className="min-w-0 flex-1 truncate text-sm text-slate-700">{assignment.title}</span><span className="shrink-0 text-xs text-slate-400">{formatDue(assignment.due_date)}</span></li>)}</ul>}</Card>
      </div></div>
    <EmergencyModal open={emergency} onClose={() => setEmergency(false)} steps={todayAssignments} onToggle={toggleComplete} encouragement={ENCOURAGEMENTS[encouragementIndex]} />
  </div>;
}

const ENCOURAGEMENTS = [
  { text: 'There is no secret ingredient. It’s just you. 🐼✨', source: 'Kung Fu Panda energy' },
  { text: 'You just need to believe. You must believe. 💛🌟', source: 'A little movie wisdom' },
  { text: 'Baddies never give up. They lock in and slay. 💅✨👑', source: 'Certified lock-in moment' },
  { text: 'POV: you thought you were cooked… but then you locked in. 😭🔥🫡', source: 'The comeback arc starts now' },
  { text: 'Okay bestie. Deep breath. Pick ONE. We move. 🫡💗', source: 'Gen-Z study mode activated' },
  { text: 'This is your training montage. 🎬🏃‍♀️ Put the soundtrack on and start with one thing.', source: 'Main-character mode' },
  { text: 'Future you is going to be SO glad you started this one. 🌱✨', source: 'A message from future you' },
  { text: 'Tung tung tung sahur has arrived. 🥁😭 It is time to LOCK IN.', source: 'Brainrot-powered productivity' },
  { text: 'Two twos, my word. ✌️😤 One assignment at a time and we are SO back.', source: 'Lock-in protocol' },
  { text: 'Plot twist: you are actually capable of doing this. 🫵💫', source: 'The plot thickens' },
  { text: 'Tiny progress is still progress. 🌱💛 You do not have to do it all at once.', source: 'Keep going' },
  { text: 'You’re not behind. You’re here. That counts. 🫶✨', source: 'Take the next small step' },
];

function EmergencyModal({ open, onClose, steps, onToggle, encouragement }: { open: boolean; onClose: () => void; steps: ReturnType<typeof rankAssignments>; onToggle: (a: import('@/types').Assignment) => void; encouragement: { text: string; source: string } }) {
  const todayCount = steps.length;
  return <Modal open={open} onClose={onClose} title="You're not alone in this 💛">
    <div className="space-y-4">
      <div className="rounded-xl bg-rose-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Feeling overwhelmed by today's workload?</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">That's okay. You don't have to solve everything at once. Let's shrink the problem down to what actually needs your attention today.</p>
      </div>
      <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-center">
        <div className="text-base font-semibold leading-6 text-slate-800">{encouragement.text}</div>
        <div className="mt-1 text-xs text-slate-500">{encouragement.source}</div>
      </div>
      {todayCount === 0 ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">You have nothing due today. Take a breath — there is no need to tackle tomorrow's work right now.</div> : <>
        <div><h3 className="font-display font-semibold text-slate-900">Just focus on today</h3><p className="mt-1 text-sm text-slate-500">Here are today's open assignments, ordered by priority. Ignore everything else for the moment.</p></div>
        <ol className="space-y-3">{steps.map(({ assignment, score }, i) => { const pr = priorityLabel(score, assignment); return <li key={assignment.id} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-900">{assignment.title}</span>{pr.label === 'Critical' && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${pr.className}`}>Critical</span>}</div><div className="mt-1 text-xs text-slate-500">Due today · {formatMinutes(assignment.estimated_minutes)}</div></div><button onClick={() => onToggle(assignment)} className="shrink-0 self-center rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">Done</button></li>; })}</ol>
        <p className="text-center text-xs text-slate-400">One assignment at a time. That's enough. 🌱</p>
      </>}
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">If your brain needs a reset first 🫶</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-lg bg-white p-2.5 text-xs text-slate-600"><Droplets className="h-4 w-4 text-sky-500" />Drink some water 💧</div>
          <div className="flex items-center gap-2 rounded-lg bg-white p-2.5 text-xs text-slate-600"><Footprints className="h-4 w-4 text-emerald-500" />Take a short walk 🌿</div>
          <div className="flex items-center gap-2 rounded-lg bg-white p-2.5 text-xs text-slate-600"><Users className="h-4 w-4 text-violet-500" />Text a friend 💬</div>
        </div>
        <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><Heart className="h-3.5 w-3.5 text-rose-400" />Taking a few minutes to reset is okay. Come back when you're ready.</p>
      </div>
    </div>
  </Modal>;
}
