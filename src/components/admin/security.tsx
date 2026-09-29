'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { qrMatrix } from '@/lib/qr';
export function SecuritySetup({ enabled }: { enabled: boolean }) {
  const [password, setPassword] = useState(''),
    [code, setCode] = useState(''),
    [uri, setUri] = useState(''),
    [codes, setCodes] = useState<string[]>([]),
    [verified, setVerified] = useState(enabled),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const secret = uri ? new URL(uri).searchParams.get('secret')! : '';
  const matrix = secret
    ? qrMatrix(`otpauth://totp/Vessy?secret=${encodeURIComponent(secret)}&issuer=Vessy`)
    : null;
  async function setup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error) throw new Error(result.error.message);
      if (!result.data || result.data.method !== 'totp')
        throw new Error('Authenticator setup is unavailable.');
      setUri(result.data.totpURI);
      setCodes(result.data.backupCodes);
      setPassword('');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) throw new Error(result.error.message);
      setVerified(true);
      setUri('');
      setCode('');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-security">
      <Link href="/" className="wordmark">
        vessy<span>®</span>
      </Link>
      <section className="admin-security-card">
        <ShieldCheck size={28} />
        <p className="admin-eyebrow">PROTECT YOUR WORKROOM</p>
        <h1>{verified ? 'Your access is protected.' : 'Set up your login code app.'}</h1>
        <p>
          An authenticator app adds a code to your password. Staff must use it in production to
          protect catalog and customer information.
        </p>
        {message && (
          <p role="alert" className="admin-notice">
            {message}
          </p>
        )}
        {!verified && !uri && (
          <form onSubmit={setup}>
            <label>
              Confirm your password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="admin-primary" disabled={busy}>
              {busy ? 'Preparing…' : 'Set up authenticator'}
            </button>
          </form>
        )}
        {!verified && matrix && (
          <>
            <p>Scan this code with your authenticator app, or enter the setup key manually.</p>
            <svg
              role="img"
              aria-label="Authenticator setup QR code"
              className="admin-qr"
              viewBox="0 0 49 49"
              shapeRendering="crispEdges"
            >
              <rect width="49" height="49" fill="white" />
              {matrix.flatMap((row, y) =>
                row.map((cell, x) =>
                  cell ? (
                    <rect key={`${x}-${y}`} x={x + 4} y={y + 4} width="1" height="1" fill="black" />
                  ) : null,
                ),
              )}
            </svg>
            <label>
              Manual setup key
              <input readOnly value={secret} autoComplete="off" spellCheck={false} />
            </label>
            <form onSubmit={verify}>
              <label>
                Authenticator code
                <input
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className="admin-primary" disabled={busy}>
                {busy ? 'Checking…' : 'Verify authenticator'}
              </button>
            </form>
          </>
        )}
        {verified && codes.length > 0 && (
          <>
            <h2>Save your backup codes</h2>
            <p>
              These are shown once. Each works for one sign-in if you lose your phone. Keep them
              somewhere private.
            </p>
            <div className="admin-backup-codes">
              {codes.map((c) => (
                <code key={c}>{c}</code>
              ))}
            </div>
            <button
              className="admin-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(codes.join('\n'));
                  setMessage('Backup codes copied.');
                } catch {
                  setMessage('Select the codes and copy them manually.');
                }
              }}
            >
              Copy backup codes
            </button>
            <label className="admin-check">
              <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              I have saved my backup codes
            </label>
          </>
        )}
        {verified && (codes.length === 0 || saved) && (
          <Link className="admin-primary" href="/admin">
            Continue to admin →
          </Link>
        )}
        {enabled && (
          <p className="admin-muted">
            Lost your authenticator? Sign in using a saved backup code, or contact the owner for the
            verified recovery process.
          </p>
        )}
      </section>
    </main>
  );
}
