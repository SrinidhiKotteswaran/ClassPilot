import { supabase, DEMO_MODE } from '@/lib/supabase';
import type { Category } from '@/types';

export interface SchoolConnection {
  id: string; user_id: string; status: 'disconnected' | 'connected' | 'error' | 'syncing'; status_message: string;
  schoology_user_id: string | null; schoology_username: string | null; school_name: string | null;
  last_synced_at: string | null; created_at: string; updated_at: string;
}

export interface SchoologyImportPayload {
  courses: Array<{ schoologyId: string; title: string; courseCode?: string | null; teacher?: string | null }>;
  assignments: Array<{ schoologyId: string; courseSchoologyId: string; title: string; description?: string | null; dueAt?: string | null; category?: string | null; pointsValue?: number; isMissing?: boolean }>;
  schoolName?: string;
  schoologyUsername?: string;
}

export interface SyncResult { classesImported: number; assignmentsImported: number; assignmentsUpdated: number; errors: string[]; message?: string; }

export async function getConnection(): Promise<SchoolConnection | null> {
  if (DEMO_MODE || !supabase) return null;
  const { data, error } = await supabase.from('school_connections').select('*').maybeSingle();
  if (error) throw error; return data;
}

export async function disconnect(): Promise<void> {
  if (DEMO_MODE || !supabase) return;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('You must be signed in.');
  const { error } = await supabase.from('school_connections').update({ status: 'disconnected', status_message: '', updated_at: new Date().toISOString() }).eq('user_id', user.id);
  if (error) throw error;
}

export async function importSchoologyPayload(payload: SchoologyImportPayload): Promise<{ classesImported: number; assignmentsImported: number; assignmentsUpdated: number }> {
  if (DEMO_MODE || !supabase) throw new Error('Supabase is not configured for this deployment.');
  const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('You must be signed in.');

  // Schoology exposes some navigation/section links as courses. A bare
  // "Section 1" is not a real class in ClassPilot; named classes such as
  // "Class of 2027: Section 1" remain valid because they contain real context.
  const courses = (Array.isArray(payload.courses) ? payload.courses : []).filter((c) => {
    const title = String(c?.title || '').replace(/\s+/g, ' ').trim();
    return !/^section\s*\d+$/i.test(title);
  });
  if (courses.length === 0) throw new Error('The import did not contain any named classes.');

  const { data: existingConn } = await supabase.from('school_connections').select('id').eq('user_id', user.id).maybeSingle();
  let connectionId = existingConn?.id;
  if (connectionId) {
    await supabase.from('school_connections').update({ status:'connected', status_message:'Imported through ClassPilot Schoology Importer.', school_name:payload.schoolName || null, schoology_username:payload.schoologyUsername || null, last_synced_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id', connectionId);
  } else {
    const { data, error } = await supabase.from('school_connections').insert({ user_id:user.id, status:'connected', status_message:'Imported through ClassPilot Schoology Importer.', school_name:payload.schoolName || null, schoology_username:payload.schoologyUsername || null, last_synced_at:new Date().toISOString() }).select('id').single();
    if (error) throw error; connectionId = data.id;
  }

  const classIds = new Map<string,string>();
  for (const c of courses.slice(0,100)) {
    const sid = String(c.schoologyId); const name = String(c.title || 'Untitled class').slice(0,300);
    const { data: old } = await supabase.from('classes').select('id').eq('user_id',user.id).eq('schoology_course_id',sid).maybeSingle();
    if (old) { await supabase.from('classes').update({ name, teacher:c.teacher || null }).eq('id',old.id); classIds.set(sid,old.id); }
    else { const { data: created, error } = await supabase.from('classes').insert({ user_id:user.id, name, teacher:c.teacher || null, schoology_course_id:sid }).select('id').single(); if (error) throw error; classIds.set(sid,created.id); }
  }

  let assignmentsImported = 0, assignmentsUpdated = 0;
  for (const a of (Array.isArray(payload.assignments) ? payload.assignments : []).slice(0,1000)) {
    const classId = classIds.get(String(a.courseSchoologyId)); if (!classId || !a.schoologyId) continue;
    const record = { user_id:user.id, class_id:classId, title:String(a.title || 'Untitled assignment').slice(0,500), description:a.description || null, category:a.category || 'preparatory', due_date:a.dueAt || null, points_value:Number(a.pointsValue || 0), source:'schoology', schoology_assignment_id:String(a.schoologyId), is_missing:Boolean(a.isMissing) };
    const { data: old } = await supabase.from('assignments').select('id').eq('user_id',user.id).eq('schoology_assignment_id',String(a.schoologyId)).maybeSingle();
    if (old) { const { error } = await supabase.from('assignments').update(record).eq('id',old.id); if (error) throw error; assignmentsUpdated++; }
    else { const { error } = await supabase.from('assignments').insert(record); if (error) throw error; assignmentsImported++; }
  }
  return { classesImported:courses.length, assignmentsImported, assignmentsUpdated };
}

export function mapSchoologyCategory(raw: string | null | undefined): Category {
  if (!raw) return 'preparatory'; const lower = raw.toLowerCase();
  if (lower.includes('summative') || lower.includes('test') || lower.includes('essay') || lower.includes('project')) return 'summative';
  if (lower.includes('formative') || lower.includes('quiz') || lower.includes('lab')) return 'formative';
  if (lower.includes('review') || lower.includes('reflect') || lower.includes('correction')) return 'review_reflect';
  return 'preparatory';
}
