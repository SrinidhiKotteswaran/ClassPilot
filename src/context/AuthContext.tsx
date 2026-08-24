import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { DEMO_MODE, supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
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

async function ensureProfile(user: User, preferredUsername?: string | null): Promise<Profile> {
  const fallbackName = preferredUsername?.trim() || user.user_metadata?.username?.trim() || user.email?.split('@')[0] || 'Student';
  const { data, error } = await supabase!
    .from('profiles')
    .upsert({ id: user.id, username: fallbackName }, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

async function loadProfile(user: User): Promise<Profile | null> {
  if (DEMO_MODE || !supabase) return getDemoProfile();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;
  return ensureProfile(user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEMO_MODE || !supabase) {
      setSession(demoSession); setProfile(getDemoProfile()); setLoading(false); return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        try { setProfile(await loadProfile(data.session.user)); }
        catch { setProfile(null); }
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // Keep database work outside the auth callback to avoid auth-lock deadlocks.
      setTimeout(() => {
        loadProfile(next.user)
          .then(setProfile)
          .catch(() => setProfile(null))
          .finally(() => setLoading(false));
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function redirectUrl() {
    return typeof window !== 'undefined' ? window.location.origin : 'https://class-pilot-sigma.vercel.app';
  }

  async function signUp(email: string, password: string, username: string) {
    if (DEMO_MODE || !supabase) return;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username }, emailRedirectTo: redirectUrl() },
    });
    if (error) throw error;
    if (data.session && data.user) setProfile(await ensureProfile(data.user, username));
  }

  async function resendConfirmation(email: string) {
    if (DEMO_MODE || !supabase) return;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: redirectUrl() },
    });
    if (error) throw error;
  }

  async function signIn(email: string, password: string) {
    if (DEMO_MODE || !supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut() { if (!DEMO_MODE && supabase) await supabase.auth.signOut(); }

  async function refreshProfile() {
    if (!session || !supabase) return;
    setProfile(await loadProfile(session.user));
  }

  return <AuthContext.Provider value={{ session, profile, loading, signUp, resendConfirmation, signIn, signOut, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
