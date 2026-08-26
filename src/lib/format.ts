export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

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

const MOTIVATION = {
  morning: [
    'New day, new XP. 🎮✨ Go get that level-up.',
    'Future you is already cheering. Give them something to celebrate. ☀️💪',
    'Main-character energy starts with one tiny first step. 🎬🚀',
    'You woke up. The quest has begun. 🗺️⚔️',
    'Plot twist: today goes better than you expected. 🌅✨',
    'You do not need to lock in for 12 hours. Just lock in for 10 minutes. ⏱️🔥',
    'Two twos, my word: you’ve got this. ✌️😤',
  ],
  afternoon: [
    'The day is not over. Your comeback arc is still loading. 🔥📈',
    'One task down is one task closer. Keep cooking. 👨‍🍳✨',
    'Do not let the afternoon convince you the day is already gone. 🌤️💪',
    'Tiny progress beats perfect plans. Keep moving. 🏃‍♀️💨',
    'POV: you started the assignment and it is already less scary. 😭📚',
    'Lock in respectfully. Your future self has receipts. 🫡📈',
    'Tung tung tung suhur… but make it your reminder to wake up your motivation. 🥁😂',
  ],
  evening: [
    'You do not need to finish everything tonight. Just make tonight count. 🌙✨',
    'The side quest can wait. Finish the main quest first. 🎮🗺️',
    'Plot twist: you actually get it done. 🎬🔥',
    'One last push. Tomorrow-you is going to be so relieved. 🌙💪',
    'Even heroes have homework. Take it one quest at a time. 🦸📚',
    'Your brain said “we’re cooked.” ClassPilot says “we have a plan.” 😭🫡',
    'The assignment is temporary. The satisfaction of finishing it? Elite. 🏆✨',
  ],
} as const;

export function motivation(): string {
  const h = new Date().getHours();
  const period: keyof typeof MOTIVATION = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const day = Math.floor(startOfToday().getTime() / 86400000);
  const choices = MOTIVATION[period];
  return choices[day % choices.length];
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
