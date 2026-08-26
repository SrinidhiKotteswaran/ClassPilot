import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Assignment, Class, Commitment } from '@/types';
import * as data from '@/services/data';
import { DEMO_MODE, supabase } from '@/lib/supabase';
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

const now = new Date();
const iso = (days: number) => new Date(now.getTime() + days * 86400000).toISOString();

const demoClasses: Class[] = [
  { id: 'calc', user_id: 'demo-user', name: 'AP Calculus BC', teacher: 'Ms. Patel', color: '#6366f1', current_grade: 96, goal_grade: 98, created_at: iso(-30) },
  { id: 'physics', user_id: 'demo-user', name: 'AP Physics C', teacher: 'Mr. Chen', color: '#0ea5e9', current_grade: 93, goal_grade: 95, created_at: iso(-29) },
  { id: 'world', user_id: 'demo-user', name: 'AP World History', teacher: 'Mrs. Davis', color: '#f59e0b', current_grade: 94, goal_grade: 95, created_at: iso(-28) },
  { id: 'lang', user_id: 'demo-user', name: 'AP English Language', teacher: 'Mr. Brooks', color: '#10b981', current_grade: 97, goal_grade: 98, created_at: iso(-27) },
];

const demoAssignments: Assignment[] = [
  { id: 'a1', user_id: 'demo-user', class_id: 'calc', title: 'Integration practice set', description: 'Finish problems 1–20 and check solutions.', category: 'formative', due_date: iso(1), estimated_minutes: 45, points_value: 20, completed: false, completed_at: null, is_missing: false, source: 'manual', created_at: iso(-1) },
  { id: 'a2', user_id: 'demo-user', class_id: 'physics', title: 'Projectile motion lab', description: 'Complete analysis and submit the lab report.', category: 'summative', due_date: iso(2), estimated_minutes: 75, points_value: 35, completed: false, completed_at: null, is_missing: false, source: 'manual', created_at: iso(-2) },
  { id: 'a3', user_id: 'demo-user', class_id: 'world', title: 'Industrial Revolution reading', description: 'Read the assigned chapter and annotate key evidence.', category: 'preparatory', due_date: iso(3), estimated_minutes: 35, points_value: 15, completed: true, completed_at: iso(-1), is_missing: false, source: 'manual', created_at: iso(-3) },
  { id: 'a4', user_id: 'demo-user', class_id: 'lang', title: 'Rhetorical analysis draft', description: 'Draft the introduction and two body paragraphs.', category: 'formative', due_date: iso(4), estimated_minutes: 60, points_value: 25, completed: false, completed_at: null, is_missing: false, source: 'manual', created_at: iso(-2) },
  { id: 'a5', user_id: 'demo-user', class_id: 'calc', title: 'Limits review', description: 'Review missed questions from the last quiz.', category: 'review_reflect', due_date: iso(-1), estimated_minutes: 25, points_value: 10, completed: true, completed_at: iso(-1), is_missing: false, source: 'manual', created_at: iso(-4) },
];

const demoCommitments: Commitment[] = [
  { id: 'm1', user_id: 'demo-user', title: 'Soccer practice', kind: 'sport', day_of_week: 1, start_time: '16:00', end_time: '18:00', created_at: iso(-10) },
  { id: 'm2', user_id: 'demo-user', title: 'Study block', kind: 'study', day_of_week: 2, start_time: '18:30', end_time: '20:00', created_at: iso(-10) },
  { id: 'm3', user_id: 'demo-user', title: 'FMPA meeting', kind: 'club', day_of_week: 3, start_time: '15:30', end_time: '16:30', created_at: iso(-10) },
];

function isSameDay(a: Date, b: Date): boolean { return a.toDateString() === b.toDateString(); }

function compassPointsFor(a: Assignment): number {
  // Compass Points are a small nudge, not a second grading system.
  // Every completion earns 2 points; finishing something due today earns +1 focus bonus.
  return 2 + (a.due_date && isSameDay(new Date(a.due_date), new Date()) ? 1 : 0);
}

async function seedDemoDataIfNeeded() {
  if (!DEMO_MODE || typeof window === 'undefined') return;
  const hasData = window.localStorage.getItem('classpilot.demo.seeded');
  if (hasData) return;
  await Promise.all(demoClasses.map((item) => data.createClass(item)));
  await Promise.all(demoAssignments.map((item) => data.createAssignment(item)));
  await Promise.all(demoCommitments.map((item) => data.createCommitment(item)));
  window.localStorage.setItem('classpilot.demo.seeded', '1');
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, profile, refreshProfile } = useAuth();
  const [classes, setClasses] = useState<Class[]>(DEMO_MODE ? demoClasses : []);
  const [assignments, setAssignments] = useState<Assignment[]>(DEMO_MODE ? demoAssignments : []);
  const [commitments, setCommitments] = useState<Commitment[]>(DEMO_MODE ? demoCommitments : []);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      if (DEMO_MODE) await seedDemoDataIfNeeded();
      const [c, a, m] = await Promise.all([data.listClasses(), data.listAssignments(), data.listCommitments()]);
      setClasses(c); setAssignments(a); setCommitments(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your data.');
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { if (session) reload(); }, [session, reload]);

  const toggleComplete = useCallback(async (a: Assignment) => {
    const nowCompleting = !a.completed;
    const points = compassPointsFor(a);

    await data.updateAssignment(a.id, {
      completed: nowCompleting,
      completed_at: nowCompleting ? new Date().toISOString() : null,
      is_missing: nowCompleting ? false : a.is_missing,
    });

    if (profile) {
      const today = new Date();
      let shouldChangePoints = false;

      if (DEMO_MODE || !supabase) {
        shouldChangePoints = true;
      } else if (nowCompleting) {
        const { data: pointEvent, error: pointEventError } = await supabase
          .from('compass_point_events')
          .insert({
            user_id: profile.id,
            assignment_id: a.id,
            points,
            reason: a.due_date && isSameDay(new Date(a.due_date), today) ? 'assignment_completed_due_today' : 'assignment_completed',
          })
          .select('id')
          .maybeSingle();

        if (pointEventError) {
          if (pointEventError.code === '23505') shouldChangePoints = false;
          else throw pointEventError;
        } else {
          shouldChangePoints = !!pointEvent;
        }
      } else {
        // Undoing completion also undoes the Compass Points earned for that completion.
        // This makes the checkbox safely reversible without creating free points.
        const { data: event, error: eventError } = await supabase
          .from('compass_point_events')
          .select('id, points')
          .eq('user_id', profile.id)
          .eq('assignment_id', a.id)
          .maybeSingle();
        if (eventError) throw eventError;
        if (event) {
          const { error: deleteError } = await supabase
            .from('compass_point_events')
            .delete()
            .eq('id', event.id);
          if (deleteError) throw deleteError;
          shouldChangePoints = true;
        }
      }

      const last = profile.last_completion_date ? new Date(`${profile.last_completion_date}T00:00:00`) : null;
      const completedToday = !!last && isSameDay(last, today);
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      // A streak represents consecutive calendar days with at least one completion.
      // Completing multiple assignments on the same day never increments it.
      let streak: number;
      if (completedToday) {
        streak = profile.streak_count;
      } else if (last && isSameDay(last, yesterday)) {
        streak = Math.max(1, profile.streak_count) + 1;
      } else {
        streak = nowCompleting ? 1 : profile.streak_count;
      }

      const profileUpdate = {
        compass_points: Math.max(0, profile.compass_points + (nowCompleting ? (shouldChangePoints ? points : 0) : (shouldChangePoints ? -points : 0))),
        streak_count: streak,
        last_completion_date: nowCompleting ? today.toISOString().slice(0, 10) : profile.last_completion_date,
      };

      if (DEMO_MODE || !supabase) {
        await import('@/context/AuthContext').then(({ updateDemoProfile }) => updateDemoProfile(profileUpdate));
      } else {
        const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', profile.id);
        if (profileError) throw profileError;
      }
      await refreshProfile();
    }
    await reload();
  }, [profile, refreshProfile, reload]);

  return <DataContext.Provider value={{ classes, assignments, commitments, loading, error, reload, toggleComplete }}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
