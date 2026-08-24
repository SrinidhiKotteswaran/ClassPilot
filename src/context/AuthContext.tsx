import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { DEMO_MODE, supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const defaultDemoProfile: Profile = {
  id: 'demo-user', username: 'Student', compass_points: 245, streak_count: 6,
  last_completion_date: new Date().toISOString().slice(0, 10), announcements_enabled: true,
  created_at: new Date().toISOString(),
};

function getDemoProfile(): Profile {
  if (typeof window === 'undefined') return defaultDemoProfile;
  try {
    const raw = window.localStorage.getItem('classpilot.demo.profile');
    return raw ? (JSON.parse(raw) as Profile) : defaultDemoProfile;
  } catch { return defaultDemoProfile; }
}

export function updateDemoProfile(patch: Partial<Profile>): void {
  if (!DEMO_MODE || typeof window === 'undefined') return;
  const next = { ...getDemoProfile(), ...patch };
  window.localStorage.setItem('classpilot.demo.profile', JSON.stringify(next));
}

const demoSession = {
  access_token: 'demo', refresh_token: 'demo', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
  user: { id: 'demo-user', aud: 'authenticated', role: 'authenticated', email: 'student@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
} as unknown as Session;

async function loadProfile(userId: string): Promise<Profile | null> {
  if (DEMO_MODE || !supabase) return getDemoProfile();
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEMO_MODE || !supabase) {
      setSession(demoSession); setProfile(getDemoProfile()); setLoading(false); return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id).then((p) => { setProfile(p); setLoading(false); });
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      (async () => { setProfile(next ? await loadProfile(next.user.id) : null); })();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp(email: string, password: string, username: string) {
    if (DEMO_MODE || !supabase) return;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      const { error: pErr } = await supabase.from('profiles').insert({ id: data.user.id, username });
      if (pErr) throw pErr;
      setProfile(await loadProfile(data.user.id));
    }
  }

  async function signIn(email: string, password: string) {
    if (DEMO_MODE || !supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() { if (!DEMO_MODE && supabase) await supabase.auth.signOut(); }

  async function refreshProfile() { if (session) setProfile(await loadProfile(session.user.id)); }

  return <AuthContext.Provider value={{ session, profile, loading, signUp, signIn, signOut, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
