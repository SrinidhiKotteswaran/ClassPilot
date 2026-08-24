import { createClient } from '@supabase/supabase-js';

// Supabase credentials are provided at Vite build time through Vercel environment variables.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Supabase environment variables are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the Vercel Production environment, then redeploy.'
  );
}

export const supabase = createClient(url, anonKey);
