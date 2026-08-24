import { supabase } from '@/lib/supabase';
import type { Assignment, Class, Commitment } from '@/types';

// ---- Classes ----
export async function listClasses(): Promise<Class[]> {
  const { data, error } = await supabase.from('classes').select('*').order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createClass(input: Partial<Class>): Promise<Class> {
  const { data, error } = await supabase.from('classes').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateClass(id: string, input: Partial<Class>): Promise<void> {
  const { error } = await supabase.from('classes').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

// ---- Assignments ----
export async function listAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAssignment(input: Partial<Assignment>): Promise<Assignment> {
  const { data, error } = await supabase.from('assignments').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createAssignments(inputs: Partial<Assignment>[]): Promise<void> {
  if (inputs.length === 0) return;
  const { error } = await supabase.from('assignments').insert(inputs);
  if (error) throw error;
}

export async function updateAssignment(id: string, input: Partial<Assignment>): Promise<void> {
  const { error } = await supabase.from('assignments').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
}

// ---- Commitments ----
export async function listCommitments(): Promise<Commitment[]> {
  const { data, error } = await supabase
    .from('commitments')
    .select('*')
    .order('day_of_week')
    .order('start_time');
  if (error) throw error;
  return data ?? [];
}

export async function createCommitment(input: Partial<Commitment>): Promise<Commitment> {
  const { data, error } = await supabase.from('commitments').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCommitment(id: string): Promise<void> {
  const { error } = await supabase.from('commitments').delete().eq('id', id);
  if (error) throw error;
}
