import { type ReactNode } from 'react';
import {
  Compass,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  ListChecks,
  Clock,
  Flame,
  LogOut,
  Trophy,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export type Route = 'dashboard' | 'upcoming' | 'classes' | 'assignments' | 'schedule' | 'settings';

const NAV: { route: Route; label: string; icon: typeof Compass }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'assignments', label: 'Assignments', icon: ListChecks },
  { route: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { route: 'classes', label: 'Classes', icon: BookOpen },
  { route: 'schedule', label: 'Schedule', icon: Clock },
  { route: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({
  route,
  onNavigate,
  children,
}: {
  route: Route;
  onNavigate: (r: Route) => void;
  children: ReactNode;
}) {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <Compass className="h-6 w-6 text-brand-600" />
          <span className="font-display text-lg font-semibold text-slate-900">Compass</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <button
              key={r}
              onClick={() => onNavigate(r)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                route === r
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-amber-600">
              <Trophy className="h-4 w-4" /> {profile?.compass_points ?? 0}
            </span>
            <span className="flex items-center gap-1.5 text-orange-500">
              <Flame className="h-4 w-4" /> {profile?.streak_count ?? 0}d
            </span>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex w-full flex-col lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-brand-600" />
            <span className="font-display font-semibold text-slate-900">Compass</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-amber-600">
              <Trophy className="h-4 w-4" /> {profile?.compass_points ?? 0}
            </span>
            <span className="flex items-center gap-1 text-orange-500">
              <Flame className="h-4 w-4" /> {profile?.streak_count ?? 0}d
            </span>
            <button onClick={signOut} className="text-slate-400 hover:text-slate-600">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pb-10">
          <div className="mx-auto max-w-5xl animate-fade-in">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white lg:hidden">
          {NAV.map(({ route: r, label, icon: Icon }) => (
            <button
              key={r}
              onClick={() => onNavigate(r)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                route === r ? 'text-brand-600' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
