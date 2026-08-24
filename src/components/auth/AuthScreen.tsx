import { useState } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

function friendlyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Something went wrong.';
  const lower = msg.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
    return 'Too many confirmation emails were requested. Please wait a little before trying again.';
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'That email is already registered. Try signing in instead.';
  }
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email first, then sign in.';
  }
  if (lower.includes('password') && (lower.includes('weak') || lower.includes('short'))) {
    return 'Please choose a stronger password.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  return msg;
}

export function AuthScreen() {
  const { signIn, signUp, resendConfirmation } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canResend, setCanResend] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null); setSuccess(null); setBusy(true); setCanResend(false);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (mode === 'signup') {
        if (username.trim().length < 2) throw new Error('Please enter a name of at least 2 characters.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        await signUp(cleanEmail, password, username.trim());
        setSuccess('Account created. Check your email to confirm your account, then sign in.');
        setCanResend(true);
      } else {
        await signIn(cleanEmail, password);
      }
    } catch (err) {
      const friendly = friendlyAuthError(err);
      setError(friendly);
      if (friendly.includes('confirmation emails') || friendly.includes('confirm your email')) setCanResend(true);
    } finally { setBusy(false); }
  }

  async function resend() {
    if (busy || !email.trim()) return;
    setError(null); setSuccess(null); setBusy(true);
    try {
      await resendConfirmation(email.trim().toLowerCase());
      setSuccess('Confirmation email sent. Check your inbox.');
      setCanResend(false);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-2"><Compass className="h-7 w-7" /><span className="font-display text-lg font-semibold">ClassPilot</span></div>
        <div><h1 className="font-display text-4xl font-bold leading-tight">Know what matters,<br />what to do next,<br />and how to improve.</h1><p className="mt-5 max-w-md text-brand-100">Your personal academic command center. Organize classes and assignments, understand priorities, and get a realistic daily plan built around your real schedule.</p></div>
        <div className="flex gap-8 text-sm text-brand-100"><div><div className="font-display text-2xl font-bold text-white">Prioritize</div>what to do first</div><div><div className="font-display text-2xl font-bold text-white">Plan</div>around real life</div><div><div className="font-display text-2xl font-bold text-white">Improve</div>your grades</div></div>
      </div>
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2"><div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex items-center gap-2 lg:hidden"><Compass className="h-7 w-7 text-brand-600" /><span className="font-display text-lg font-semibold text-slate-900">ClassPilot</span></div>
        <h2 className="font-display text-2xl font-bold text-slate-900">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="mt-1 text-sm text-slate-500">{mode === 'signin' ? 'Sign in to reach your dashboard.' : 'Start organizing your academic life in minutes.'}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'signup' && <Field label="Name"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Alex Rivera" autoComplete="name" required /></Field>}
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" autoComplete="email" required /></Field>
          <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required /></Field>
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-100">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-100">{success}</div>}
          <Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
          {mode === 'signup' && canResend && <button type="button" onClick={resend} disabled={busy} className="w-full text-sm font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50">Resend confirmation email</button>}
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}<button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null); setCanResend(false); }} className="font-medium text-brand-600 hover:text-brand-700">{mode === 'signin' ? 'Sign up' : 'Sign in'}</button></p>
      </div></div>
    </div>
  );
}
