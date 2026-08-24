import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
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

export function UpcomingPage() {
  const { classes, assignments, loading } = useData();
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  const days = useMemo<DayGroup[]>(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const groups: DayGroup[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(start.getTime() + i * DAY_MS);
      groups.push({
        date,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        isToday: i === 0,
        items: [],
      });
    }
    const overflow: { assignment: Assignment; cls?: Class }[] = [];

    for (const a of assignments) {
      if (a.completed) continue;
      const due = a.due_date ? new Date(a.due_date) : null;
      if (!due) {
        overflow.push({ assignment: a, cls: a.class_id ? classById.get(a.class_id) : undefined });
        continue;
      }
      due.setHours(0, 0, 0, 0);
      const diff = Math.round((due.getTime() - start.getTime()) / DAY_MS);
      if (diff < 0) {
        groups[0].items.push({ assignment: a, cls: a.class_id ? classById.get(a.class_id) : undefined });
      } else if (diff < 14) {
        groups[diff].items.push({ assignment: a, cls: a.class_id ? classById.get(a.class_id) : undefined });
      } else {
        overflow.push({ assignment: a, cls: a.class_id ? classById.get(a.class_id) : undefined });
      }
    }

    for (const g of groups) {
      g.items.sort((a, b) => (a.assignment.due_date ?? '').localeCompare(b.assignment.due_date ?? ''));
    }
    return groups;
  }, [assignments, classById]);

  if (loading) {
    return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>;
  }

  const total = assignments.filter((a) => !a.completed).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Upcoming workload</h1>
        <p className="mt-1 text-sm text-slate-500">The next 14 days at a glance. {total} open assignments.</p>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="Nothing on the horizon"
          description="You have no open assignments due in the next two weeks. Add one to start planning ahead."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((day) => (
            <Card key={day.date.toISOString()} className={day.isToday ? 'ring-2 ring-brand-500/40' : ''}>
              <CardHeader
                title={day.label}
                subtitle={day.items.length === 0 ? 'Nothing due' : `${day.items.length} ${day.items.length === 1 ? 'item' : 'items'}`}
              />
              {day.items.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {day.items.map(({ assignment, cls }) => {
                    const meta = CATEGORIES[assignment.category];
                    const overdue = !assignment.completed && isOverdue(assignment.due_date);
                    return (
                      <li key={assignment.id} className="flex items-start gap-2 px-4 py-2.5">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-slate-900">{assignment.title}</span>
                            {overdue && <span className="shrink-0 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-600">OVERDUE</span>}
                          </div>
                          <div className="text-xs text-slate-500">
                            {cls?.name ?? 'No class'} · {meta.short}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-4 py-6 text-center text-xs text-slate-400">Free day</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
