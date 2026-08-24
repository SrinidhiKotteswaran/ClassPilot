import { createClient } from '@supabase/supabase-js';

// These are public Supabase client credentials. The legacy anon key is used here
// for maximum compatibility with the current supabase-js auth client.
const SUPABASE_URL = 'https://ixolapnghbfpmspdpesn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4b2xhcG5naGJmcG1zcGRwZXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTMwNTIsImV4cCI6MjEwMzE2OTA1Mn0.yXfAIjKeSgKFY32thJ8wt7D_4EnI5BlrCnfuErwfbis';

export const DEMO_MODE = false;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
