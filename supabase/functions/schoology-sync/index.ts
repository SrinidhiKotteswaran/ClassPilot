// Schoology sync edge function.
//
// This is the secure server-side boundary for the Schoology integration. It
// holds the Schoology API credentials (configured as edge function secrets)
// and performs all Schoology API calls. The React client never sees these
// secrets — it calls this function with the user's JWT, and the function acts
// on behalf of the authenticated user.
//
// REQUIRED SECRETS (configure via Supabase dashboard or MCP):
//   SCHOOLOGY_CONSUMER_KEY    — OAuth consumer key
//   SCHOOLOGY_CONSUMER_SECRET — OAuth consumer secret
//   SCHOOLOGY_USER_TOKEN      — (optional) pre-authorized user OAuth token
//   SCHOOLOGY_USER_SECRET     — (optional) pre-authorized user OAuth token secret
//
// When secrets are NOT configured, the function returns a clear "not configured"
// error so the UI can show an honest state instead of faking a connection.
//
// The Schoology REST API uses OAuth 1.0a for request signing. This function
// implements a minimal HMAC-SHA1 signer for the three-legged OAuth flow.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Env {
  SCHOOLOGY_CONSUMER_KEY?: string;
  SCHOOLOGY_CONSUMER_SECRET?: string;
  SCHOOLOGY_USER_TOKEN?: string;
  SCHOOLOGY_USER_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// --- OAuth 1.0a HMAC-SHA1 signing (minimal, Schoology-compatible) ---

function pctEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function hmacSha1(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function genNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signedFetch(
  url: string,
  method: string,
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string,
): Promise<Response> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: token,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: genNonce(),
    oauth_version: '1.0',
  };

  const allParams: Record<string, string> = { ...oauthParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${pctEncode(k)}=${pctEncode(allParams[k])}`)
    .join('&');

  const baseString = `${method.toUpperCase()}&${pctEncode(url)}&${pctEncode(paramString)}`;
  const signingKey = `${pctEncode(consumerSecret)}&${pctEncode(tokenSecret)}`;
  const signature = await hmacSha1(signingKey, baseString);
  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map((k) => `${pctEncode(k)}="${pctEncode(oauthParams[k])}"`)
    .join(', ');

  return fetch(url, { method, headers: { Authorization: authHeader } });
}

// --- Schoology API helpers ---

const SCHOOLOGY_API = 'https://api.schoology.com/v1';

interface SchoologyCourse {
  id: string;
  course_title: string;
  course_code?: string;
  instructors?: Array<{ uid: string; name: string }>;
  school?: { title?: string };
}

interface SchoologyAssignment {
  id: string;
  title: string;
  description?: string;
  due_date?: string | null;
  category?: string | null;
  points?: string | null;
  completed?: number | null;
  grade?: string | null;
}

interface SchoologyGrade {
  grade: string;
  final_grade?: string;
}

function mapCategory(raw: string | null | undefined): string {
  if (!raw) return 'preparatory';
  const lower = raw.toLowerCase();
  if (lower.includes('summative') || lower.includes('test') || lower.includes('essay') || lower.includes('project')) return 'summative';
  if (lower.includes('formative') || lower.includes('quiz') || lower.includes('lab')) return 'formative';
  if (lower.includes('review') || lower.includes('reflect') || lower.includes('correction')) return 'review_reflect';
  return 'preparatory';
}

function defaultPointsForCategory(cat: string): number {
  if (cat === 'summative') return 75;
  if (cat === 'formative') return 40;
  if (cat === 'review_reflect') return 15;
  return 10;
}

function defaultMinutesForCategory(cat: string): number {
  if (cat === 'summative') return 120;
  if (cat === 'formative') return 60;
  if (cat === 'review_reflect') return 25;
  return 30;
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const env: Env = Deno.env.toObject();
    const hasCredentials = !!(env.SCHOOLOGY_CONSUMER_KEY && env.SCHOOLOGY_CONSUMER_SECRET);

    // Build a service-role Supabase client to read/write user data.
    const supabase = createClient(
      env.SUPABASE_URL ?? '',
      env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );

    // Authenticate the caller via their JWT.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? 'sync';

    if (action === 'status') {
      return jsonResponse({
        configured: hasCredentials,
        message: hasCredentials
          ? 'Schoology credentials are configured.'
          : 'Schoology credentials are not configured. Set SCHOOLOGY_CONSUMER_KEY and SCHOOLOGY_CONSUMER_SECRET as edge function secrets.',
      });
    }

    if (action === 'disconnect') {
      await supabase
        .from('school_connections')
        .update({ status: 'disconnected', status_message: '', schoology_user_id: null, schoology_username: null, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      return jsonResponse({ ok: true });
    }

    // action === 'sync'
    if (!hasCredentials) {
      await supabase
        .from('school_connections')
        .upsert({
          user_id: userId,
          status: 'error',
          status_message: 'Schoology API credentials are not configured. Ask your administrator to set them up.',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      return jsonResponse({
        error: 'Schoology API credentials are not configured. This is an administrator setup step — the integration architecture is ready, but the Schoology API keys need to be added as edge function secrets.',
      }, 503);
    }

    const userToken = env.SCHOOLOGY_USER_TOKEN ?? '';
    const userSecret = env.SCHOOLOGY_USER_SECRET ?? '';

    if (!userToken || !userSecret) {
      await supabase
        .from('school_connections')
        .upsert({
          user_id: userId,
          status: 'pending',
          status_message: 'Schoology credentials are configured, but your personal Schoology authorization is not yet linked. OAuth user token flow is required.',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      return jsonResponse({
        error: 'Schoology consumer credentials are configured, but your personal Schoology authorization (OAuth user token) is not yet linked. The OAuth flow to obtain per-user access tokens requires additional configuration.',
      }, 403);
    }

    // --- Fetch Schoology data ---
    const ck = env.SCHOOLOGY_CONSUMER_KEY!;
    const cs = env.SCHOOLOGY_CONSUMER_SECRET!;

    // Get user info
    let schoologyUsername: string | null = null;
    let schoolName: string | null = null;
    try {
      const meRes = await signedFetch(`${SCHOOLOGY_API}/users/me`, 'GET', ck, cs, userToken, userSecret);
      if (meRes.ok) {
        const me = await meRes.json();
        schoologyUsername = me.name_display || me.name_uid || null;
      }
    } catch {
      // Non-fatal — continue with sync
    }

    // Fetch courses (sections)
    const coursesRes = await signedFetch(`${SCHOOLOGY_API}/sections`, 'GET', ck, cs, userToken, userSecret);
    if (!coursesRes.ok) {
      const errText = await coursesRes.text().catch(() => '');
      await supabase
        .from('school_connections')
        .upsert({
          user_id: userId,
          status: 'error',
          status_message: `Schoology API error: ${coursesRes.status}. ${errText}`.slice(0, 500),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      return jsonResponse({ error: `Failed to fetch Schoology courses (${coursesRes.status}).` }, 502);
    }

    const coursesBody = await coursesRes.json();
    const courses: SchoologyCourse[] = coursesBody.section ?? coursesBody.sections ?? [];

    let classesImported = 0;
    let assignmentsImported = 0;
    let assignmentsUpdated = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    // Sync courses → classes
    for (const course of courses) {
      // Check if we already have a link
      const { data: existingLink } = await supabase
        .from('external_class_links')
        .select('class_id')
        .eq('user_id', userId)
        .eq('external_id', course.id)
        .maybeSingle();

      const teacher = course.instructors?.[0]?.name ?? '';
      const school = course.school?.title ?? null;

      if (existingLink) {
        // Update class name/teacher (Schoology-controlled fields)
        await supabase
          .from('classes')
          .update({ name: course.course_title, teacher })
          .eq('id', existingLink.class_id);
        await supabase
          .from('external_class_links')
          .update({ external_name: course.course_title, last_synced_at: now })
          .eq('class_id', existingLink.class_id);
      } else {
        // Create new class
        const { data: newClass } = await supabase
          .from('classes')
          .insert({ user_id: userId, name: course.course_title, teacher, color: 'blue' })
          .select()
          .single();
        if (newClass) {
          await supabase
            .from('external_class_links')
            .insert({ user_id: userId, class_id: newClass.id, external_id: course.id, external_name: course.course_title, last_synced_at: now });
          classesImported++;
        }
      }

      if (school) schoolName = school;
    }

    // Fetch assignments per course
    for (const course of courses) {
      const { data: link } = await supabase
        .from('external_class_links')
        .select('class_id')
        .eq('user_id', userId)
        .eq('external_id', course.id)
        .maybeSingle();
      if (!link) continue;

      let assignments: SchoologyAssignment[] = [];
      try {
        const aRes = await signedFetch(`${SCHOOLOGY_API}/sections/${course.id}/assignments`, 'GET', ck, cs, userToken, userSecret);
        if (aRes.ok) {
          const aBody = await aRes.json();
          assignments = aBody.assignment ?? [];
        }
      } catch {
        errors.push(`Could not fetch assignments for ${course.course_title}`);
        continue;
      }

      for (const sa of assignments) {
        const { data: existing } = await supabase
          .from('external_assignment_links')
          .select('assignment_id, external_grade')
          .eq('user_id', userId)
          .eq('external_id', sa.id)
          .maybeSingle();

        const category = mapCategory(sa.category);
        const dueDate = sa.due_date ? new Date(sa.due_date).toISOString() : null;
        const completed = sa.completed === 1;

        if (existing) {
          // Update Schoology-controlled fields only (don't overwrite student edits to title/description)
          const updatePayload: Record<string, unknown> = {};
          if (dueDate) updatePayload.due_date = dueDate;
          updatePayload.completed = completed;
          updatePayload.is_missing = false;
          await supabase.from('assignments').update(updatePayload).eq('id', existing.assignment_id);
          await supabase
            .from('external_assignment_links')
            .update({ external_category: sa.category ?? null, external_grade: sa.grade ? Number(sa.grade) : null, last_synced_at: now })
            .eq('assignment_id', existing.assignment_id);
          assignmentsUpdated++;
        } else {
          const { data: newA } = await supabase
            .from('assignments')
            .insert({
              user_id: userId,
              class_id: link.class_id,
              title: sa.title,
              description: sa.description ?? '',
              category,
              due_date: dueDate,
              estimated_minutes: defaultMinutesForCategory(category),
              points_value: defaultPointsForCategory(category),
              completed,
              source: 'schoology',
            })
            .select()
            .single();
          if (newA) {
            await supabase
              .from('external_assignment_links')
              .insert({
                user_id: userId,
                assignment_id: newA.id,
                external_id: sa.id,
                external_course_id: course.id,
                external_category: sa.category ?? null,
                external_grade: sa.grade ? Number(sa.grade) : null,
                last_synced_at: now,
              });
            assignmentsImported++;
          }
        }
      }

      // Fetch grade for this course
      try {
        const gRes = await signedFetch(`${SCHOOLOGY_API}/sections/${course.id}/grades`, 'GET', ck, cs, userToken, userSecret);
        if (gRes.ok) {
          const gBody = await gRes.json();
          const grades: SchoologyGrade[] = gBody.grades ?? gBody.grade ?? [];
          if (grades.length > 0) {
            const finalGrade = grades[0].final_grade ?? grades[0].grade;
            if (finalGrade) {
              const num = parseFloat(finalGrade);
              if (!isNaN(num)) {
                const { data: link2 } = await supabase
                  .from('external_class_links')
                  .select('class_id')
                  .eq('user_id', userId)
                  .eq('external_id', course.id)
                  .maybeSingle();
                if (link2) {
                  await supabase.from('classes').update({ current_grade: num }).eq('id', link2.class_id);
                }
              }
            }
          }
        }
      } catch {
        // Grade fetch is best-effort
      }
    }

    // Mark connection as connected
    await supabase
      .from('school_connections')
      .upsert({
        user_id: userId,
        status: 'connected',
        status_message: '',
        schoology_username: schoologyUsername,
        school_name: schoolName,
        last_synced_at: now,
        updated_at: now,
      }, { onConflict: 'user_id' });

    return jsonResponse({
      classesImported,
      assignmentsImported,
      assignmentsUpdated,
      errors,
    } as SyncResult);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown sync error';
    return jsonResponse({ error: msg }, 500);
  }
});

interface SyncResult {
  classesImported: number;
  assignmentsImported: number;
  assignmentsUpdated: number;
  errors: string[];
}
