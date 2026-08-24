import { useMemo, useState } from 'react';
import {
  Trophy,
  Flame,
  ListChecks,
  AlertTriangle,
  Sparkles,
  LifeBuoy,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { Route } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { greeting, formatMinutes, formatDue } from '@/lib/format';
import { rankAssignments, priorityLabel } from '@/lib/priority';
import { availableMinutesToday, buildTodayPlan } from '@/lib/planner';
import { CATEGORIES } from '@/lib/categories';

function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  tone: string;
}) {
  return (
    <Card className="p-4">
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        {icon}
      </div>
      <div className="font-display text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </Card>
  );
}

export function Dashboard({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { profile } = useAuth();
  const { classes, assignments, commitments, loading, toggleComplete } = useData();
  const [emergency, setEmergency] = useState(false);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const minutesAvailable = useMemo(() => availableMinutesToday(commitments), [commitments]);
  const plan = useMemo(
    () => buildTodayPlan(assignments, classes, minutesAvailable),
    [assignments, classes, minutesAvailable],
  );
  const ranked = useMemo(() => rankAssignments(assignments, classes), [assignments, classes]);
  const missing = useMemo(
    () => ranked.filter((r) => r.assignment.is_missing || r.reasons.some((x) => x.includes('overdue'))),
    [ranked],
  );
  const dueToday = ranked.filter((r) => {
    const d = r.assignment.due_date;
    return d && new Date(d).toDateString() === new Date().toDateString();
  }).length;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const top = ranked[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {greeting()}, {profile?.username?.split(' ')[0] || 'there'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ranked.length === 0
              ? "You're all caught up. Add assignments to get a plan."
              : `You have ${ranked.length} open ${ranked.length === 1 ? 'task' : 'tasks'} and about ${formatMinutes(minutesAvailable)} free today.`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setEmergency(true)}>
          <LifeBuoy className="h-4 w-4 text-rose-500" />
          I'm overwhelmed
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Trophy className="h-5 w-5" />} value={profile?.compass_points ?? 0} label="Compass Points" tone="bg-amber-50 text-amber-600" />
        <Stat icon={<Flame className="h-5 w-5" />} value={`${profile?.streak_count ?? 0}d`} label="Stress-free streak" tone="bg-orange-50 text-orange-500" />
        <Stat icon={<ListChecks className="h-5 w-5" />} value={dueToday} label="Due today" tone="bg-sky-50 text-sky-600" />
        <Stat icon={<AlertTriangle className="h-5 w-5" />} value={missing.length} label="Missing / overdue" tone="bg-rose-50 text-rose-600" />
      </div>

      {top && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 bg-brand-50/60 px-5 py-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Recommended next
              </div>
              <div className="mt-0.5 font-display font-semibold text-slate-900">
                {top.assignment.title}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {top.reasons.length > 0 ? top.reasons.join(' · ') : 'A good place to start.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader
              title="Today's plan"
              subtitle={`Fits about ${formatMinutes(plan.totalMinutes)} of ${formatMinutes(minutesAvailable)} free time`}
            />
            {plan.blocks.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                Nothing to plan yet. Add an assignment to see your day.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {plan.blocks.map(({ assignment, reasons, score, fits }) => {
                  const meta = CATEGORIES[assignment.category];
                  const pr = priorityLabel(score);
                  return (
                    <li key={assignment.id} className="flex items-start gap-3 px-5 py-3">
                      <button
                        onClick={() => toggleComplete(assignment)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 transition-colors hover:border-brand-500"
                        aria-label="Mark complete"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">
                            {assignment.title}
                          </span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${pr.className}`}>
                            {pr.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {reasons[0] ?? meta.label} · {formatMinutes(assignment.estimated_minutes)}
                          {!fits && ' · beyond today\u2019s free time'}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{formatDue(assignment.due_date)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {missing.length > 0 && (
            <Card>
              <CardHeader title="Recover missing work" subtitle="Often the fastest grade boost" />
              <ul className="divide-y divide-slate-100">
                {missing.slice(0, 4).map(({ assignment }) => (
                  <li key={assignment.id} className="flex items-center gap-3 px-5 py-3">
                    <button
                      onClick={() => toggleComplete(assignment)}
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-rose-300 hover:border-rose-500"
                      aria-label="Mark complete"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                      {assignment.title}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-rose-600">
                      {classById.get(assignment.class_id ?? '')?.name ?? 'No class'}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Upcoming"
              action={
                <button
                  onClick={() => onNavigate('upcoming')}
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  View <ArrowRight className="h-3.5 w-3.5" />
                </button>
              }
            />
            {ranked.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">No upcoming work.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {ranked.slice(0, 5).map(({ assignment }) => (
                  <li key={assignment.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-slate-300" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                      {assignment.title}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDue(assignment.due_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <EmergencyModal
        open={emergency}
        onClose={() => setEmergency(false)}
        steps={ranked.slice(0, 3)}
        onToggle={toggleComplete}
      />
    </div>
  );
}

function EmergencyModal({
  open,
  onClose,
  steps,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  steps: ReturnType<typeof rankAssignments>;
  onToggle: (a: import('@/types').Assignment) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Recovery plan">
      <p className="text-sm text-slate-600">
        Take a breath. Forget the full list for now — just do these, in order. Finish one, then look
        again.
      </p>
      {steps.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">You have nothing open right now. You're okay.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {steps.map(({ assignment, reasons }, i) => (
            <li key={assignment.id} className="flex gap-3 rounded-xl bg-slate-50 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900">{assignment.title}</div>
                <div className="text-xs text-slate-500">{reasons[0] ?? 'Start here.'}</div>
              </div>
              <button
                onClick={() => onToggle(assignment)}
                className="shrink-0 self-center rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50"
              >
                Done
              </button>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
