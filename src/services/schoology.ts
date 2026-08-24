import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';

export interface SchoolConnection {
  id: string;
  user_id: string;
  status: 'disconnected' | 'pending' | 'connected' | 'error';
  status_message: string;
  schoology_user_id: string | null;
  schoology_username: string | null;
  school_name: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  classesImported: number;
  assignmentsImported: number;
  assignmentsUpdated: number;
  errors: string[];
}

export async function getConnection(): Promise<SchoolConnection | null> {
  const { data, error } = await supabase.from('school_connections').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertConnection(input: Partial<SchoolConnection>): Promise<void> {
  const { error } = await supabase.from('school_connections').upsert(input, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function disconnect(): Promise<void> {
  const { error } = await supabase
    .from('school_connections')
    .update({ status: 'disconnected', status_message: '', schoology_user_id: null, schoology_username: null, updated_at: new Date().toISOString() })
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '');
  if (error) throw error;
}

/**
 * Triggers a Schoology sync by calling the server-side edge function. The edge
 * function holds the Schoology API credentials and performs the actual API
 * calls — the client never sees Schoology secrets.
 */
export async function triggerSync(): Promise<SyncResult> {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('You must be signed in to sync.');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/schoology-sync`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: 'sync' }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Sync failed (${res.status})`);
  }

  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body as SyncResult;
}

/**
 * Maps a Schoology category string to Academic Compass's internal category
 * system. Used by the sync edge function and available here for previewing.
 */
export function mapSchoologyCategory(raw: string | null | undefined): Category {
  if (!raw) return 'preparatory';
  const lower = raw.toLowerCase();
  if (lower.includes('summative') || lower.includes('test') || lower.includes('essay') || lower.includes('project')) return 'summative';
  if (lower.includes('formative') || lower.includes('quiz') || lower.includes('lab')) return 'formative';
  if (lower.includes('review') || lower.includes('reflect') || lower.includes('correction')) return 'review_reflect';
  return 'preparatory';
}
