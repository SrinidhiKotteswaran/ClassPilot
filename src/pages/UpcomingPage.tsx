import { useEffect, useMemo, useRef } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import type { Assignment, Class } from '@/types';
import { useData } from '@/context/DataContext';
import { Card, CardHeader } from '@/components/ui/Card';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { CATEGORIES } from '@/lib/categories';
import { isOverdue } from '@/lib/format';

interface DayGroup {
  date: Date;
  label: string;
  isToday: boolean;
  items: { assignment: Assignment; cls?: Class }[];
}

const DAY_MS = 86400000;
const FUTURE_DAYS = 14;

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function UpcomingPage() {
  const { classes, assignments, loading, toggleComplete } = useData();
  const todayRef = useRef<HTMLDivElement | null>(null);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const days = useMemo<DayGroup[]>(() => {
    const today = startOfDay(new Date());

    // Start at the earliest assignment date instead of showing an arbitrary
    // 30 days of empty calendar space. Completed assignments are still kept,
    // so this naturally becomes the user's full assignment history.
    const datedAssignments = assignments.filter((a) => Boolean(a.due_date));
    const firstAssignmentDate = datedAssignments.reduce<Date | null>((earliest, a) => {
      const due = startOfDay(new Date(a.due_date!));
      return !earliest || due < earliest ? due : earliest;
    }, null);

    const start = firstAssignmentDate && firstAssignmentDate < today ? firstAssignmentDate : today;
    const end = new Date(today.getTime() + FUTURE_DAYS * DAY_MS);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
    const groups: DayGroup[] = [];

    for (let offset = 0; offset < totalDays; offset++) {
      const date = new Date(start.getTime() + offset * DAY_MS);
      const isToday = date.getTime() === today.getTime();
      const diffFromToday = Math.round((date.getTime() - today.getTime()) / DAY_MS);
      const label = isToday
        ? 'Today'
        : diffFromToday === -1
          ? 'Yesterday'
          : diffFromToday === 1
            ? 'Tomorrow'
            : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      groups.push({ date, label, isToday, items: [] });
    }

    const startTime = start.getTime();
    for (const a of assignments) {
      if (!a.due_date) continue;
      const due = startOfDay(new Date(a.due_date));
      const diff = Math.round((due.getTime() - startTime) / DAY_MS);
      if (diff >= 0 && diff < groups.length) {
        groups[diff].items.push({ assignment: a, cls: a.class_id ? classById.get(a.class_id) : undefined });
      }
    }

    for (const g of groups) {
      g.items.sort((a, b) => (a.assignment.due_date ?? '').localeCompare(b.assignment.due_date ?? ''));
    }
    return groups;
  }, [assignments, classById]);

  // When the calendar opens, put today's section in view automatically so
  // users can immediately see what needs attention without scrolling through history.
  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(() => {
        todayRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
    }
  }, [loading, days.length]);

  if (loading) {
    return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>;
  }

  const total = assignments.filter((a) => !a.completed).length;
  const hasCalendarItems = days.some((day) => day.items.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Assignment calendar</h1>
        <p className="mt-1 text-sm text-slate-500">
          {total} open assignments. Scroll through your assignment history and what is coming next.
        </p>
      </div>

      {!hasCalendarItems ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="Nothing on the calendar"
          description="You have no assignments with due dates in this window."
        />
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <div key={day.date.toISOString()} ref={day.isToday ? todayRef : undefined} className="scroll-mt-4">
              <Card className={day.isToday ? 'ring-2 ring-brand-500/40' : ''}>
                <CardHeader
                  title={day.label}
                  subtitle={day.items.length === 0 ? 'Nothing due' : `${day.items.length} ${day.items.length === 1 ? 'assignment' : 'assignments'}`}
                />
                {day.items.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {day.items.map(({ assignment, cls }) => {
                      const meta = CATEGORIES[assignment.category];
                      const overdue = !assignment.completed && isOverdue(assignment.due_date);
                      return (
                        <li
                          key={assignment.id}
                          className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${assignment.completed ? 'bg-slate-50/50' : ''}`}
                        >
                          <button
                            onClick={() => void toggleComplete(assignment)}
                            aria-label={assignment.completed ? 'Mark assignment incomplete' : 'Mark assignment complete'}
                            title={assignment.completed ? 'Mark incomplete' : 'Mark complete'}
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                              assignment.completed
                                ? 'border-slate-300 bg-slate-200 text-slate-500 hover:border-brand-500 hover:bg-brand-50'
                                : 'border-slate-300 hover:border-brand-500'
                            }`}
                          >
                            {assignment.completed && <Check className="h-3.5 w-3.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`truncate text-sm font-medium ${assignment.completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                {assignment.title}
                              </span>
                              {overdue && <span className="shrink-0 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-600">OVERDUE</span>}
                              {assignment.completed && <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">COMPLETED</span>}
                            </div>
                            <div className={`text-xs ${assignment.completed ? 'text-slate-400' : 'text-slate-500'}`}>
                              {cls?.name ?? 'No class'} · {meta.short}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-4 py-4 text-center text-xs text-slate-400">Free day</div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
