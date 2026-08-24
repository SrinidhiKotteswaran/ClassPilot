import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If Supabase is not configured in Vercel yet, keep the UI usable in Demo Mode.
// Once the VITE_SUPABASE_* variables are present, the real client is used.
export const DEMO_MODE = !url || !anonKey;
export const supabase = DEMO_MODE ? null : createClient(url, anonKey);
