import type { Category } from '@/types';

interface CategoryMeta {
  value: Category;
  label: string;
  short: string;
  /** Relative grade impact weight, 0..1, used by the priority engine. */
  weight: number;
  /** Default compass points awarded on completion. */
  defaultPoints: number;
  /** Default effort estimate in minutes. */
  defaultMinutes: number;
  /** Tailwind classes for a subtle badge. */
  badge: string;
  dot: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  summative: {
    value: 'summative',
    label: 'Summative Assessment',
    short: 'Summative',
    weight: 1,
    defaultPoints: 75,
    defaultMinutes: 120,
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
    dot: 'bg-rose-500',
  },
  formative: {
    value: 'formative',
    label: 'Formative Assessment',
    short: 'Formative',
    weight: 0.7,
    defaultPoints: 40,
    defaultMinutes: 60,
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
    dot: 'bg-amber-500',
  },
  preparatory: {
    value: 'preparatory',
    label: 'Preparatory',
    short: 'Prep',
    weight: 0.4,
    defaultPoints: 10,
    defaultMinutes: 30,
    badge: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
    dot: 'bg-sky-500',
  },
  review_reflect: {
    value: 'review_reflect',
    label: 'Review & Reflect',
    short: 'Review',
    weight: 0.3,
    defaultPoints: 15,
    defaultMinutes: 25,
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    dot: 'bg-slate-400',
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);
