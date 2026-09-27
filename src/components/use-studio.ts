'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import type { Draft, Command } from '@/modules/configuration/types';
export function useStudio() {
  const [draft, setDraft] = useState<Draft | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [user, setUser] = useState<{ name: string; email: string } | null>(null),
    [mode, setMode] = useState<'guided' | 'ai'>('guided');
  const lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/studio', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'The studio is temporarily unavailable.');
      setDraft(d.draft);
      setUser(d.user);
      setMode(d.assistantMode);
      return d.draft as Draft;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your studio.');
      return null;
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/studio', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error?.message || 'The studio is temporarily unavailable.');
        return data;
      })
      .then((data) => {
        setDraft(data.draft);
        setUser(data.user);
        setMode(data.assistantMode);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Unable to load your studio.');
      });
    return () => controller.abort();
  }, []);
  const request = useCallback(
    async (endpoint: string, payload: unknown) => {
      if (lock.current || !draft) return null;
      lock.current = true;
      setBusy(true);
      setError('');
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId: crypto.randomUUID(),
            expectedRevision: draft.revision,
            ...(payload as object),
          }),
        });
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 409) await load();
          throw new Error(d.error?.message || d.message || 'That change could not be saved.');
        }
        if (d.draft) setDraft(d.draft);
        return d.draft as Draft;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That change could not be saved.');
        return null;
      } finally {
        setBusy(false);
        lock.current = false;
      }
    },
    [draft, load],
  );
  return {
    draft,
    user,
    busy,
    error,
    setError,
    mode,
    load,
    command: (command: Command) => request('/api/studio', { command }),
    chat: (message: string) => request('/api/chat', { message }),
  };
}
