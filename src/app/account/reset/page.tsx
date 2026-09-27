'use client';
import { useState } from 'react';
import { createAuthClient } from 'better-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
const client = createAuthClient();
export default function Reset() {
  const [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className="account-page">
      <Link href="/" className="wordmark">
        vessy<span>®</span>
      </Link>
      <div className="account-card">
        <h1>Choose a new password.</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const token = new URLSearchParams(window.location.search).get('token');
            if (!token) {
              setMessage('This reset link is missing or expired. Request a new link.');
              setBusy(false);
              return;
            }
            try {
              const r = await client.resetPassword({ newPassword: password, token });
              setMessage(r.error?.message || 'Your password has been reset. You can now sign in.');
            } catch {
              setMessage('That reset could not be completed. Please try again.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button disabled={busy} type="submit">
            Reset password
          </Button>
        </form>
        {message && <p role="status">{message}</p>}
        <Link href="/account">Return to sign in</Link>
      </div>
    </main>
  );
}
