import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Unlink, CheckCircle2, AlertCircle, Chrome, RefreshCw } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { getConnection, disconnect, type SchoolConnection } from '@/services/schoology';

export function SettingsPage() {
  const { session, profile } = useAuth();
  const [conn, setConn] = useState<SchoolConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setConn(await getConnection()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load connection.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function handleDisconnect() {
    try { await disconnect(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not disconnect.'); }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>;
  const isConnected = conn?.status === 'connected';
  const isError = conn?.status === 'error';
  const displayName = profile?.username || session?.user.user_metadata?.username || 'Student';
  const email = session?.user.email || '—';

  return <div className="space-y-5">
    <div><h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1><p className="mt-1 text-sm text-slate-500">Manage your account, school connection, and preferences.</p></div>
    <Card><CardHeader title="Account details" subtitle="Your ClassPilot account information" /><div className="grid gap-3 p-5 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><div className="min-w-0"><div className="text-xs font-medium uppercase tracking-wide text-slate-400">Name</div><div className="truncate text-sm font-medium text-slate-900">{displayName}</div></div></div>
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><div className="min-w-0"><div className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</div><div className="truncate text-sm font-medium text-slate-900">{email}</div></div></div>
    </div></Card>

    <Card><CardHeader title="Schoology connection" subtitle="Keep your classes and assignments synchronized from Schoology" /><div className="p-5">
      <div className={`mb-4 flex items-start gap-3 rounded-xl p-4 ${isConnected ? 'bg-brand-50' : isError ? 'bg-rose-50' : 'bg-slate-50'}`}>
        {isConnected ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-600" /> : isError ? <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600" /> : <GraduationCap className="mt-0.5 h-5 w-5 text-slate-400" />}
        <div><div className="text-sm font-semibold text-slate-900">{isConnected ? 'Schoology is connected' : isError ? 'Schoology connection issue' : 'Connect Schoology'}</div><p className="mt-0.5 text-sm text-slate-600">{isConnected ? 'Your Schoology data can now sync automatically while Schoology is open.' : isError ? conn?.status_message : 'Use the ClassPilot browser extension while you are signed into Schoology.'}</p>{isConnected && conn?.last_synced_at && <p className="mt-1 text-xs text-slate-400">Last synced {new Date(conn.last_synced_at).toLocaleString()}</p>}</div>
      </div>
      {error && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start gap-3"><Chrome className="mt-0.5 h-5 w-5 text-slate-500" /><div><div className="font-semibold text-slate-900">ClassPilot Schoology Sync</div><p className="mt-1 text-sm text-slate-500">The browser extension reads the Schoology pages you are already signed into and sends the imported classes and assignments to your ClassPilot account. Your Schoology password is never read or stored.</p></div></div>
        <ol className="mt-4 space-y-2 text-sm text-slate-600"><li><b>1.</b> Load the <code>extension/</code> folder as an unpacked Chrome extension.</li><li><b>2.</b> Make sure you are signed into ClassPilot in this browser.</li><li><b>3.</b> Open Schoology and click <b>Connect &amp; sync</b> in the ClassPilot panel.</li><li><b>4.</b> The extension imports your classes and assignments and keeps them updated automatically.</li></ol>
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" onClick={() => void load()}><RefreshCw className="h-4 w-4" />Refresh status</Button>{isConnected && <Button variant="ghost" onClick={handleDisconnect}><Unlink className="h-4 w-4" />Disconnect</Button>}</div>
      </div>
      <p className="mt-4 text-xs text-slate-400">ClassPilot only reads Schoology data from pages available in your existing browser session. It does not receive your Schoology login credentials.</p>
    </div></Card>
  </div>;
}
