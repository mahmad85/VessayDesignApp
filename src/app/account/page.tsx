'use client';
import { useEffect, useState } from 'react';
import { createAuthClient } from 'better-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
const client = createAuthClient();
export default function Account() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin'),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [config, setConfig] = useState<{ enabled: boolean; localEmail: boolean } | null>(null);
  const { data: session, isPending } = client.useSession();
  useEffect(() => {
    fetch('/api/auth-config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setMessage('Account settings are unavailable.'));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result =
        mode === 'signup'
          ? await client.signUp.email({ name, email, password, callbackURL: '/account' })
          : mode === 'reset'
            ? await client.requestPasswordReset({ email, redirectTo: '/account/reset' })
            : await client.signIn.email({ email, password, callbackURL: '/' });
      if (result.error)
        setMessage(result.error.message || 'Please check your details and try again.');
      else if (mode === 'signup')
        setMessage('Check your email to verify your account before signing in.');
      else if (mode === 'reset')
        setMessage('If an account exists, password reset instructions will be sent.');
      else router.replace('/');
    } catch {
      setMessage('We could not complete that request. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page">
      <Link className="wordmark" href="/">
        vessy<span>®</span>
      </Link>
      <Link className="back-link" href="/">
        <ArrowLeft size={15} />
        Back to your studio
      </Link>
      <div className="account-card">
        <LockKeyhole size={25} />
        <div className="eyebrow">YOUR PERSONAL TAILORING STUDIO</div>
        <h1>
          {session
            ? 'Make yourself at home.'
            : mode === 'signup'
              ? 'Your style, saved.'
              : mode === 'reset'
                ? 'A fresh start.'
                : 'Welcome back.'}
        </h1>
        {session ? (
          <>
            <p>Signed in as {session.user.email}.</p>
            <Button asChild>
              <Link href="/">
                Continue your design
                <ArrowRight size={16} />
              </Link>
            </Button>
            <button
              className="text-button"
              onClick={async () => {
                await client.signOut();
                router.replace('/');
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <p>
              {mode === 'signup'
                ? 'Create an account to return to your designs.'
                : mode === 'reset'
                  ? 'We’ll send you a secure link to reset your password.'
                  : 'Sign in to pick up where you left off.'}
            </p>
            {config?.enabled === false ? (
              <div className="auth-notice">
                Account setup is not complete on this deployment. You can continue designing as a
                guest.
              </div>
            ) : (
              <form onSubmit={submit}>
                {mode === 'signup' && (
                  <label>
                    Name
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      maxLength={100}
                    />
                  </label>
                )}
                <label>
                  Email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    maxLength={200}
                  />
                </label>
                {mode !== 'reset' && (
                  <label>
                    Password
                    <input
                      required
                      type="password"
                      minLength={12}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    />
                    {mode === 'signup' && <small>At least 12 characters.</small>}
                  </label>
                )}
                <Button
                  disabled={busy || !config || isPending}
                  type="submit"
                  className="full-width"
                >
                  {busy
                    ? 'One moment…'
                    : mode === 'signup'
                      ? 'Create account'
                      : mode === 'reset'
                        ? 'Send reset link'
                        : 'Sign in'}
                  <ArrowRight size={16} />
                </Button>
              </form>
            )}
            <div className="account-links">
              <button
                onClick={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setMessage('');
                }}
              >
                {mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : 'New here? Create an account'}
              </button>
              {mode === 'signin' && (
                <button
                  onClick={() => {
                    setMode('reset');
                    setMessage('');
                  }}
                >
                  Forgot password?
                </button>
              )}
              {mode === 'reset' && (
                <button onClick={() => setMode('signin')}>Back to sign in</button>
              )}
            </div>
          </>
        )}
        {message && (
          <p className="auth-notice" role="status">
            {message}
          </p>
        )}
        {config?.localEmail && (
          <p className="fine-print">
            Local development: verification and reset emails are written to the private development
            outbox. Email delivery must be connected for a public launch.
          </p>
        )}
      </div>
    </main>
  );
}
