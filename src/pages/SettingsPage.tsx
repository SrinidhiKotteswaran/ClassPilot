import { useCallback, useEffect, useState } from 'react';
import {
  GraduationCap,
  RefreshCw,
  Unlink,
  Link2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';
import {
  getConnection,
  triggerSync,
  disconnect,
  type SchoolConnection,
  type SyncResult,
} from '@/services/schoology';

export function SettingsPage() {
  const [conn, setConn] = useState<SchoolConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConn(await getConnection());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const result = await triggerSync();
      setSyncResult(result);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      await load();
      setSyncResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect.');
    }
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Spinner className="h-8 w-8" /></div>;
  }

  const isConnected = conn?.status === 'connected';
  const isPending = conn?.status === 'pending';
  const isError = conn?.status === 'error';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your school platform connection and preferences.</p>
      </div>

      <Card>
        <CardHeader
          title="Schoology connection"
          subtitle="Automatically import your courses, assignments, and grades"
        />
        <div className="p-5">
          {/* Status banner */}
          <div
            className={`mb-4 flex items-start gap-3 rounded-xl p-4 ${
              isConnected
                ? 'bg-brand-50'
                : isError
                  ? 'bg-rose-50'
                  : isPending
                    ? 'bg-amber-50'
                    : 'bg-slate-50'
            }`}
          >
            {isConnected ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            ) : isError ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            ) : isPending ? (
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">
                {isConnected
                  ? 'Schoology is connected'
                  : isPending
                    ? 'Connection in progress'
                    : isError
                      ? 'Connection issue'
                      : 'Not connected'}
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                {isConnected && conn?.schoology_username && `Signed in as ${conn.schoology_username}`}
                {isConnected && conn?.school_name && ` · ${conn.school_name}`}
                {isPending && conn?.status_message}
                {isError && conn?.status_message}
                {!isConnected && !isPending && !isError &&
                  'Connect your Schoology account to automatically sync courses, assignments, and grades.'}
              </p>
              {isConnected && conn?.last_synced_at && (
                <p className="mt-1 text-xs text-slate-400">
                  Last synced {new Date(conn.last_synced_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {/* Sync result */}
          {syncResult && (
            <div className="mb-4 rounded-xl bg-slate-50 p-4 text-sm">
              <div className="font-medium text-slate-900">Sync complete</div>
              <ul className="mt-2 space-y-1 text-slate-600">
                <li>{syncResult.classesImported} classes synced</li>
                <li>{syncResult.assignmentsImported} new assignments imported</li>
                <li>{syncResult.assignmentsUpdated} assignments updated</li>
                {syncResult.errors.length > 0 && (
                  <li className="text-rose-600">{syncResult.errors.length} errors (some items may not have synced)</li>
                )}
              </ul>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!isConnected ? (
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {syncing ? 'Connecting...' : 'Connect & sync'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={handleSync} disabled={syncing}>
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {syncing ? 'Syncing...' : 'Sync now'}
                </Button>
                <Button variant="ghost" onClick={handleDisconnect} disabled={syncing}>
                  <Unlink className="h-4 w-4" />
                  Disconnect
                </Button>
              </>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-400">
            Schoology integration requires API credentials configured by an administrator.
            The connection architecture is fully built — when credentials are added, your
            courses, assignments, categories, and grades will sync automatically.
          </p>
        </div>
      </Card>
    </div>
  );
}
