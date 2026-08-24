import { Check, Clock, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import type { Assignment, Class } from '@/types';
import { CATEGORIES } from '@/lib/categories';
import { formatDue, formatMinutes, isOverdue } from '@/lib/format';

export function AssignmentItem({
  assignment,
  cls,
  onToggle,
  onEdit,
  onDelete,
}: {
  assignment: Assignment;
  cls?: Class;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const meta = CATEGORIES[assignment.category];
  const overdue = !assignment.completed && isOverdue(assignment.due_date);

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
      <button
        onClick={onToggle}
        aria-label={assignment.completed ? 'Mark incomplete' : 'Mark complete'}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
          assignment.completed
            ? 'border-brand-600 bg-brand-600 text-white'
            : 'border-slate-300 hover:border-brand-500'
        }`}
      >
        {assignment.completed && <Check className="h-3.5 w-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-sm font-medium ${
              assignment.completed ? 'text-slate-400 line-through' : 'text-slate-900'
            }`}
          >
            {assignment.title}
          </span>
          {(overdue || assignment.is_missing) && !assignment.completed && (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {cls && (
            <span className="inline-flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              {cls.name}
            </span>
          )}
          <span className={overdue ? 'font-medium text-rose-600' : ''}>
            {formatDue(assignment.due_date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatMinutes(assignment.estimated_minutes)}
          </span>
        </div>
      </div>

      <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline ${meta.badge}`}>
        {meta.short}
      </span>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
