import type { Assignment, Class } from '@/types';
import { CATEGORIES } from '@/lib/categories';
import { daysUntil, isOverdue } from '@/lib/format';

export interface ScoredAssignment {
  assignment: Assignment;
  score: number;
  reasons: string[];
}

/**
 * Deterministic priority engine. Deadline urgency is the primary student-facing
 * signal; grade impact and effort only help choose between assignments with the
 * same/nearby deadline.
 */
export function scoreAssignment(a: Assignment, cls: Class | undefined): ScoredAssignment {
  const reasons: string[] = [];
  let score = 0;

  const days = daysUntil(a.due_date);
  const overdue = !a.completed && (a.is_missing || isOverdue(a.due_date));

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

/** Only show the two actionable urgency labels requested by the dashboard:
 * Critical = due today; Overdue = missing or past due. Everything else is
 * intentionally unlabeled so the UI stays calm and deadline-focused.
 */
export function priorityLabel(_score: number, assignment?: Assignment): { label: string; className: string } {
  if (!assignment?.due_date) return { label: '', className: '' };

  const overdue = assignment.is_missing || isOverdue(assignment.due_date);
  if (overdue) {
    return { label: 'Overdue', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' };
  }

  if (daysUntil(assignment.due_date) === 0) {
    return { label: 'Critical', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' };
  }

  return { label: '', className: '' };
}
