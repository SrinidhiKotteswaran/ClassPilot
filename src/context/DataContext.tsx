import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Assignment, Class, Commitment } from '@/types';
import * as data from '@/services/data';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface DataState {
  classes: Class[];
  assignments: Assignment[];
  commitments: Commitment[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  toggleComplete: (a: Assignment) => Promise<void>;
}

const DataContext = createContext<DataState | undefined>(undefined);

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, profile, refreshProfile } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [c, a, m] = await Promise.all([
        data.listClasses(),
        data.listAssignments(),
        data.listCommitments(),
      ]);
      setClasses(c);
      setAssignments(a);
      setCommitments(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your data.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) reload();
  }, [session, reload]);

  const toggleComplete = useCallback(
    async (a: Assignment) => {
      const nowCompleting = !a.completed;
      await data.updateAssignment(a.id, {
        completed: nowCompleting,
        completed_at: nowCompleting ? new Date().toISOString() : null,
        is_missing: nowCompleting ? false : a.is_missing,
      });

      if (nowCompleting && profile) {
        const today = new Date();
        const last = profile.last_completion_date ? new Date(profile.last_completion_date) : null;
        let streak = profile.streak_count;
        if (!last || !isSameDay(last, today)) {
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          streak = last && isSameDay(last, yesterday) ? streak + 1 : 1;
        }
        await supabase
          .from('profiles')
          .update({
            compass_points: profile.compass_points + a.points_value,
            streak_count: streak,
            last_completion_date: today.toISOString().slice(0, 10),
          })
          .eq('id', profile.id);
        await refreshProfile();
      }

      await reload();
    },
    [profile, refreshProfile, reload],
  );

  return (
    <DataContext.Provider
      value={{ classes, assignments, commitments, loading, error, reload, toggleComplete }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
