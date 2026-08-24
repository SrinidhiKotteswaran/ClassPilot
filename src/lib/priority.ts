import type { Assignment, Class } from '@/types';
import { CATEGORIES } from '@/lib/categories';
import { daysUntil, isOverdue } from '@/lib/format';

export interface ScoredAssignment {
  assignment: Assignment;
  score: number;
  reasons: string[];
}

/**
 * Deterministic priority engine. Ranks assignments by combining deadline
 * urgency, grade impact (category weight + how far a class is from its goal),
 * missing status, and effort. Every factor that moved the score is surfaced as
 * a plain-English reason so recommendations are always explainable.
 */
export function scoreAssignment(a: Assignment, cls: Class | undefined): ScoredAssignment {
  const reasons: string[] = [];
  let score = 0;

  const days = daysUntil(a.due_date);
  if (a.is_missing || (isOverdue(a.due_date) && !a.completed)) {
    score += 55;
    reasons.push('Missing or overdue — completing it can recover grade quickly');
  } else if (days !== null) {
    if (days <= 0) {
      score += 45;
      reasons.push('Due today');
    } else if (days === 1) {
      score += 35;
      reasons.push('Due tomorrow');
    } else if (days <= 3) {
      score += 24;
      reasons.push(`Due in ${days} days`);
    } else if (days <= 7) {
      score += 12;
      reasons.push('Due this week');
    } else {
      score += 4;
    }
  }

  const meta = CATEGORIES[a.category];
  const impact = Math.round(meta.weight * 30);
  score += impact;
  if (meta.weight >= 0.7) {
    reasons.push(`High grade impact (${meta.short.toLowerCase()})`);
  }

  if (cls && cls.current_grade != null && cls.goal_grade != null) {
    const gap = cls.goal_grade - cls.current_grade;
    if (gap > 0) {
      score += Math.min(20, gap * 1.5);
      reasons.push(`Supports your ${cls.name} goal (${cls.current_grade}% → ${cls.goal_grade}%)`);
    }
  }

  if (a.estimated_minutes <= 30) {
    score += 4;
  }

  return { assignment: a, score: Math.round(score), reasons };
}

export function rankAssignments(assignments: Assignment[], classes: Class[]): ScoredAssignment[] {
  const byId = new Map(classes.map((c) => [c.id, c]));
  return assignments
    .filter((a) => !a.completed)
    .map((a) => scoreAssignment(a, a.class_id ? byId.get(a.class_id) : undefined))
    .sort((x, y) => y.score - x.score);
}

export function priorityLabel(score: number): { label: string; className: string } {
  if (score >= 70) return { label: 'Critical', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' };
  if (score >= 45) return { label: 'High', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' };
  if (score >= 25) return { label: 'Medium', className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100' };
  return { label: 'Low', className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' };
}
