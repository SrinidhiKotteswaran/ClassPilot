import { DEMO_MODE, supabase } from '@/lib/supabase';
import type { Assignment, Class, Commitment } from '@/types';

const STORAGE_KEYS = {
  classes: 'classpilot.demo.classes',
  assignments: 'classpilot.demo.assignments',
  commitments: 'classpilot.demo.commitments',
};

function read<T>(key: string, fallback: T): T {
  if (!DEMO_MODE || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function write<T>(key: string, value: T): void {
  if (!DEMO_MODE || typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function id(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }

export async function listClasses(): Promise<Class[]> {
  if (DEMO_MODE || !supabase) return read<Class[]>(STORAGE_KEYS.classes, []);
  const { data, error } = await supabase.from('classes').select('*').order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createClass(input: Partial<Class>): Promise<Class> {
  if (DEMO_MODE || !supabase) {
    const item: Class = { id: id('class'), user_id: 'demo-user', name: input.name ?? 'New class', teacher: input.teacher ?? '', color: input.color ?? 'blue', current_grade: input.current_grade ?? null, goal_grade: input.goal_grade ?? null, created_at: new Date().toISOString() };
    write(STORAGE_KEYS.classes, [...await listClasses(), item]);
    return item;
  }
  const { data, error } = await supabase.from('classes').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateClass(id: string, input: Partial<Class>): Promise<void> {
  if (DEMO_MODE || !supabase) { write(STORAGE_KEYS.classes, (await listClasses()).map((item) => item.id === id ? { ...item, ...input } : item)); return; }
  const { error } = await supabase.from('classes').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteClass(id: string): Promise<void> {
  if (DEMO_MODE || !supabase) {
    write(STORAGE_KEYS.classes, (await listClasses()).filter((item) => item.id !== id));
    write(STORAGE_KEYS.assignments, (await listAssignments()).filter((item) => item.class_id !== id));
    return;
  }
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

export async function listAssignments(): Promise<Assignment[]> {
  if (DEMO_MODE || !supabase) return read<Assignment[]>(STORAGE_KEYS.assignments, []);
  const { data, error } = await supabase.from('assignments').select('*').order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAssignment(input: Partial<Assignment>): Promise<Assignment> {
  if (DEMO_MODE || !supabase) {
    const item: Assignment = { id: id('assignment'), user_id: 'demo-user', class_id: input.class_id ?? null, title: input.title ?? 'New assignment', description: input.description ?? '', category: input.category ?? 'formative', due_date: input.due_date ?? null, estimated_minutes: input.estimated_minutes ?? 30, points_value: input.points_value ?? 10, completed: input.completed ?? false, completed_at: input.completed_at ?? null, is_missing: input.is_missing ?? false, source: input.source ?? 'manual', created_at: new Date().toISOString() };
    write(STORAGE_KEYS.assignments, [...await listAssignments(), item]);
    return item;
  }
  const { data, error } = await supabase.from('assignments').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createAssignments(inputs: Partial<Assignment>[]): Promise<void> {
  if (inputs.length === 0) return;
  if (DEMO_MODE || !supabase) { for (const input of inputs) await createAssignment(input); return; }
  const { error } = await supabase.from('assignments').insert(inputs);
  if (error) throw error;
}

export async function updateAssignment(id: string, input: Partial<Assignment>): Promise<void> {
  if (DEMO_MODE || !supabase) { write(STORAGE_KEYS.assignments, (await listAssignments()).map((item) => item.id === id ? { ...item, ...input } : item)); return; }
  const { error } = await supabase.from('assignments').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteAssignment(id: string): Promise<void> {
  if (DEMO_MODE || !supabase) { write(STORAGE_KEYS.assignments, (await listAssignments()).filter((item) => item.id !== id)); return; }
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
}

export async function listCommitments(): Promise<Commitment[]> {
  if (DEMO_MODE || !supabase) return read<Commitment[]>(STORAGE_KEYS.commitments, []);
  const { data, error } = await supabase.from('commitments').select('*').order('day_of_week').order('start_time');
  if (error) throw error;
  return data ?? [];
}

export async function createCommitment(input: Partial<Commitment>): Promise<Commitment> {
  if (DEMO_MODE || !supabase) {
    const item: Commitment = { id: id('commitment'), user_id: 'demo-user', title: input.title ?? 'New commitment', kind: input.kind ?? 'other', day_of_week: input.day_of_week ?? 0, start_time: input.start_time ?? '16:00', end_time: input.end_time ?? '17:00', created_at: new Date().toISOString() };
    write(STORAGE_KEYS.commitments, [...await listCommitments(), item]);
    return item;
  }
  const { data, error } = await supabase.from('commitments').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCommitment(id: string): Promise<void> {
  if (DEMO_MODE || !supabase) { write(STORAGE_KEYS.commitments, (await listCommitments()).filter((item) => item.id !== id)); return; }
  const { error } = await supabase.from('commitments').delete().eq('id', id);
  if (error) throw error;
}
