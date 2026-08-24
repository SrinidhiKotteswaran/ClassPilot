import type { Assignment, Class, Commitment } from '@/types';
import { rankAssignments, type ScoredAssignment } from '@/lib/priority';

/**
 * Estimates minutes available for schoolwork today from the student's weekly
 * commitments. Assumes a waking window of 07:00–22:00 and subtracts any
 * commitment on today's weekday, then reserves a buffer so plans stay realistic.
 */
export function availableMinutesToday(commitments: Commitment[]): number {
  const dow = new Date().getDay();
  const wakeStart = 7 * 60;
  const wakeEnd = 22 * 60;
  let committed = 0;
  for (const c of commitments) {
    if (c.day_of_week !== dow) continue;
    const [sh, sm] = c.start_time.split(':').map(Number);
    const [eh, em] = c.end_time.split(':').map(Number);
    const start = Math.max(wakeStart, sh * 60 + sm);
    const end = Math.min(wakeEnd, eh * 60 + em);
    if (end > start) committed += end - start;
  }
  const free = wakeEnd - wakeStart - committed;
  // Reserve ~40% for meals, breaks, downtime.
  return Math.max(0, Math.round(free * 0.6));
}

export interface PlanBlock extends ScoredAssignment {
  fits: boolean;
}

/** Selects the highest-priority assignments that fit today's available time. */
export function buildTodayPlan(
  assignments: Assignment[],
  classes: Class[],
  minutesAvailable: number,
): { blocks: PlanBlock[]; totalMinutes: number } {
  const ranked = rankAssignments(assignments, classes);
  const blocks: PlanBlock[] = [];
  let used = 0;
  for (const item of ranked) {
    const need = item.assignment.estimated_minutes;
    const fits = used + need <= minutesAvailable;
    if (fits) used += need;
    blocks.push({ ...item, fits });
    if (blocks.length >= 6) break;
  }
  return { blocks, totalMinutes: used };
}
