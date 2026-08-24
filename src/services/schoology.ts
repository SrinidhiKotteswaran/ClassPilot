import { supabase, DEMO_MODE } from '@/lib/supabase';
import type { Category } from '@/types';

export interface SchoolConnection {
  id: string;
  user_id: string;
  status: 'disconnected' | 'connected' | 'error' | 'syncing';
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
  message?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const IMPORT_CODE_FUNCTION = `${SUPABASE_URL}/functions/v1/schoology-import-code`;

export async function getConnection(): Promise<SchoolConnection | null> {
  if (DEMO_MODE || !supabase) return null;
  const { data, error } = await supabase.from('school_connections').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function disconnect(): Promise<void> {
  if (DEMO_MODE || !supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const { error } = await supabase
    .from('school_connections')
    .update({ status: 'disconnected', status_message: '', schoology_user_id: null, schoology_username: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function createSchoologyImportCode(): Promise<{ code: string; expiresAt: string }> {
  if (DEMO_MODE || !supabase) throw new Error('Supabase is not configured for this deployment.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in.');
  const response = await fetch(IMPORT_CODE_FUNCTION, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Could not create an import code.');
  return data as { code: string; expiresAt: string };
}

export function mapSchoologyCategory(raw: string | null | undefined): Category {
  if (!raw) return 'preparatory';
  const lower = raw.toLowerCase();
  if (lower.includes('summative') || lower.includes('test') || lower.includes('essay') || lower.includes('project')) return 'summative';
  if (lower.includes('formative') || lower.includes('quiz') || lower.includes('lab')) return 'formative';
  if (lower.includes('review') || lower.includes('reflect') || lower.includes('correction')) return 'review_reflect';
  return 'preparatory';
}
