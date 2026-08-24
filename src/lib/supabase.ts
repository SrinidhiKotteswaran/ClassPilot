import { createClient } from '@supabase/supabase-js';

// Supabase project used by ClassPilot. The URL and publishable key are safe to
// ship to the browser; RLS is the security boundary. Vercel env vars can still
// override these values when configured.
const DEFAULT_SUPABASE_URL = 'https://ixolapnghbfpmspdpesn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_ye8jOcaRyBAvcqRyLmmimg_EYiXkEcc';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const DEMO_MODE = false;
export const supabase = createClient(url, anonKey);
