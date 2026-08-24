import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, Unlink, CheckCircle2, AlertCircle, Loader2, User, Mail, Upload, Chrome } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/context/AuthContext';
import { getConnection, disconnect, importSchoologyPayload, type SchoolConnection, type SchoologyImportPayload } from '@/services/schoology';

export function SettingsPage() {
  const { session, profile } = useAuth();
  const [conn, setConn] = useState<SchoolConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setConn(await getConnection()); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load connection.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setImporting(true); setError(null); setMessage(null);
    try {
      const payload = JSON.parse(await file.text()) as SchoologyImportPayload;
      const result = await importSchoologyPayload(payload);
      setMessage(`Imported ${result.classesImported} classes and ${result.assignmentsImported + result.assignmentsUpdated} assignments.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not import the Schoology file.'); }
    finally { setImporting(false); event.target.value = ''; }
  }

  async function handleDisconnect() { try { await disconnect(); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not disconnect.'); } }

  if (loading) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>;
  const isConnected = conn?.status === 'connected';
  const isError = conn?.status === 'error';
  const displayName = profile?.username || session?.user.user_metadata?.username || 'Student';
  const email = session?.user.email || '—';

  return <div className="space-y-5">
    <div><h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1><p className="mt-1 text-sm text-slate-500">Manage your account, school connection, and preferences.</p></div>
    <Card><CardHeader title="Account details" subtitle="Your ClassPilot account information" /><div className="grid gap-3 p-5 sm:grid-cols-2">
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><User className="h-5 w-5 shrink-0 text-slate-400" /><div className="min-w-0"><div className="text-xs font-medium uppercase tracking-wide text-slate-400">Name</div><div className="truncate text-sm font-medium text-slate-900">{displayName}</div></div></div>
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><Mail className="h-5 w-5 shrink-0 text-slate-400" /><div className="min-w-0"><div className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</div><div className="truncate text-sm font-medium text-slate-900">{email}</div></div></div>
    </div></Card>
    <Card><CardHeader title="Schoology connection" subtitle="Import your classes and assignments from Schoology" /><div className="p-5">
      <div className={`mb-4 flex items-start gap-3 rounded-xl p-4 ${isConnected ? 'bg-brand-50' : isError ? 'bg-rose-50' : 'bg-slate-50'}`}>
        {isConnected ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-600" /> : isError ? <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600" /> : <GraduationCap className="mt-0.5 h-5 w-5 text-slate-400" />}
        <div><div className="text-sm font-semibold text-slate-900">{isConnected ? 'Schoology is connected' : isError ? 'Schoology connection issue' : 'Connect Schoology'}</div><p className="mt-0.5 text-sm text-slate-600">{isConnected ? 'Your latest Schoology import is connected.' : isError ? conn?.status_message : 'Use the ClassPilot browser extension while you are signed into Schoology.'}</p>{isConnected && conn?.last_synced_at && <p className="mt-1 text-xs text-slate-400">Last imported {new Date(conn.last_synced_at).toLocaleString()}</p>}</div>
      </div>
      {error && <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {message && <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><Chrome className="mt-0.5 h-5 w-5 text-slate-500" /><div><div className="font-semibold text-slate-900">ClassPilot Schoology Importer</div><p className="mt-1 text-sm text-slate-500">The extension reads the Schoology pages you open and creates a local JSON export. You choose when to upload that export into ClassPilot.</p></div></div>
        <ol className="mt-4 space-y-2 text-sm text-slate-600"><li><b>1.</b> Install the extension from the <code>extension/</code> folder.</li><li><b>2.</b> Open Schoology and click <b>Prepare ClassPilot import</b>.</li><li><b>3.</b> Open the extension and click <b>Export for ClassPilot</b>.</li><li><b>4.</b> Upload the downloaded JSON here.</li></ol>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" />
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{importing ? 'Importing...' : 'Upload Schoology export'}</Button>{isConnected && <Button variant="ghost" onClick={handleDisconnect}><Unlink className="h-4 w-4" />Disconnect</Button>}</div>
      </div>
      <p className="mt-4 text-xs text-slate-400">The upload is an explicit action you control; ClassPilot does not receive Schoology login credentials.</p>
    </div></Card>
  </div>;
}
