import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { Assignment, Category } from '@/types';
import { useData } from '@/context/DataContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import { AssignmentItem } from '@/components/assignments/AssignmentItem';
import { AssignmentForm } from '@/components/assignments/AssignmentForm';
import { CATEGORIES, CATEGORY_LIST } from '@/lib/categories';
import { rankAssignments } from '@/lib/priority';
import * as data from '@/services/data';

type Filter = 'all' | 'open' | 'completed' | 'missing';

export function AssignmentsPage() {
  const { classes, assignments, loading, toggleComplete, reload } = useData();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [classFilter, setClassFilter] = useState('all');
  const [catFilter, setCatFilter] = useState<Category | 'all'>('all');

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const ranked = useMemo(() => rankAssignments(assignments, classes), [assignments, classes]);

  const filtered = useMemo(() => {
    let list = filter === 'completed' ? assignments.filter((a) => a.completed) : ranked.map((r) => r.assignment);
    if (filter === 'missing') list = list.filter((a) => a.is_missing);
    if (filter === 'open') list = list.filter((a) => !a.completed);

    if (classFilter !== 'all') list = list.filter((a) => a.class_id === classFilter);
    if (catFilter !== 'all') list = list.filter((a) => a.category === catFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    return list;
  }, [ranked, assignments, filter, classFilter, catFilter, query]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Assignments</h1>
          <p className="mt-1 text-sm text-slate-500">
            {assignments.length} total · {assignments.filter((a) => !a.completed).length} open
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assignments..."
              className="pl-9"
            />
          </div>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-auto">
            <option value="open">Open</option>
            <option value="missing">Missing</option>
            <option value="completed">Completed</option>
            <option value="all">All</option>
          </Select>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="w-auto">
            <option value="all">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value as Category | 'all')} className="w-auto">
            <option value="all">All categories</option>
            {CATEGORY_LIST.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Plus className="h-6 w-6" />}
          title="No assignments here"
          description={assignments.length === 0 ? "Add your first assignment to start building your plan." : "No assignments match these filters."}
          action={assignments.length === 0 ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add assignment</Button> : undefined}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {filtered.map((a) => (
              <AssignmentItem
                key={a.id}
                assignment={a}
                cls={a.class_id ? classById.get(a.class_id) : undefined}
                onToggle={() => toggleComplete(a)}
                onEdit={() => { setEditing(a); setFormOpen(true); }}
                onDelete={async () => {
                  await data.deleteAssignment(a.id);
                  await reload();
                }}
              />
            ))}
          </ul>
        </Card>
      )}

      <AssignmentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        classes={classes}
        existing={editing}
      />
    </div>
  );
}
