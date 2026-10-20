import type { Assignment, Class } from '@/types';
import { CATEGORIES } from '@/lib/categories';
import { daysUntil, isOverdue } from '@/lib/format';

export interface ScoredAssignment {
  assignment: Assignment;
  score: number;
  reasons: string[];
}

function isActuallyOverdue(a: Assignment): boolean {
  // Assignment due dates are calendar deadlines: an item due today is "Due today"
  // for the whole day, not overdue merely because its timestamp parses to midnight.
  const days = daysUntil(a.due_date);
  if (days !== null && days < 0) return true;

  // A Schoology "missing" flag should not make future work overdue because of
  // stale metadata. A missing item with no due date still deserves attention.
  if (!a.is_missing) return false;
  return !a.due_date;
}

export function scoreAssignment(a: Assignment, cls: Class | undefined): ScoredAssignment {
  const reasons: string[] = [];
  let score = 0;
  const days = daysUntil(a.due_date);
  const overdue = !a.completed && isActuallyOverdue(a);

  if (overdue) {
    score += 100;
    reasons.push('Missing or overdue');
  } else if (days !== null) {
    if (days === 0) {
      score += 90;
      reasons.push('Due today');
    } else if (days === 1) {
      score += 70;
      reasons.push('Due tomorrow');
    } else if (days <= 7) {
      score += Math.max(10, 60 - days * 5);
      reasons.push(`Due in ${days} days`);
    } else {
      score += 5;
    }
  }

  const meta = CATEGORIES[a.category];
  score += Math.round(meta.weight * 20);

  if (cls && cls.current_grade != null && cls.goal_grade != null) {
    const gap = cls.goal_grade - cls.current_grade;
    if (gap > 0) score += Math.min(10, gap);
  }

  if (a.estimated_minutes <= 30) score += 2;
  return { assignment: a, score: Math.round(score), reasons };
}

export function rankAssignments(assignments: Assignment[], classes: Class[]): ScoredAssignment[] {
  const byId = new Map(classes.map((c) => [c.id, c]));
  return assignments
    .filter((a) => !a.completed)
    .map((a) => scoreAssignment(a, a.class_id ? byId.get(a.class_id) : undefined))
    .sort((x, y) => {
      const xTime = x.assignment.due_date ? new Date(x.assignment.due_date).getTime() : Number.POSITIVE_INFINITY;
      const yTime = y.assignment.due_date ? new Date(y.assignment.due_date).getTime() : Number.POSITIVE_INFINITY;
      if (xTime !== yTime) return xTime - yTime;
      return y.score - x.score;
    });
}

export function priorityLabel(_score: number, assignment?: Assignment): { label: string; className: string } {
  if (!assignment || assignment.completed) return { label: '', className: '' };

  if (isActuallyOverdue(assignment)) {
    return { label: 'Overdue', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' };
  }

  if (daysUntil(assignment.due_date) === 0) {
    return { label: 'Critical', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' };
  }

  return { label: '', className: '' };
}
