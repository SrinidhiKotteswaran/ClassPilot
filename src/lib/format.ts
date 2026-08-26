export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Calendar-day difference in the user's local timezone.
 * A due time later today is still 0 days away, not 1 day away just because
 * it is more than 24 hours from the current clock time in another timezone.
 */
export function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const due = new Date(dateIso);
  if (Number.isNaN(due.getTime())) return null;
  const today = startOfToday();
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  return Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateIso: string | null): boolean {
  if (!dateIso) return false;
  const due = new Date(dateIso);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

export function formatDue(dateIso: string | null): string {
  if (!dateIso) return 'No due date';
  const due = new Date(dateIso);
  if (Number.isNaN(due.getTime())) return 'No due date';
  const days = daysUntil(dateIso);
  const time = due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days === null) return 'No due date';
  if (days < 0) return `Overdue by ${Math.abs(days)}d`;
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days < 7) return due.toLocaleDateString(undefined, { weekday: 'long' }) + `, ${time}`;
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
