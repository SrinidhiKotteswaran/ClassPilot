import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { AppShell, type Route } from '@/components/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { AssignmentsPage } from '@/pages/AssignmentsPage';
import { UpcomingPage } from '@/pages/UpcomingPage';
import { ClassesPage } from '@/pages/ClassesPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { Spinner } from '@/components/ui/Feedback';

function AppContent() {
  const { session, loading } = useAuth();
  const [route, setRoute] = useState<Route>('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <DataProvider>
      <AppShell route={route} onNavigate={setRoute}>
        {route === 'dashboard' && <Dashboard onNavigate={setRoute} />}
        {route === 'assignments' && <AssignmentsPage />}
        {route === 'upcoming' && <UpcomingPage />}
        {route === 'classes' && <ClassesPage />}
        {route === 'schedule' && <SchedulePage />}
        {route === 'settings' && <SettingsPage />}
      </AppShell>
    </DataProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
