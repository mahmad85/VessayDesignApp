'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { customerCatalogSchema, indexCatalog, type RuntimeIndex } from '@/modules/catalog/snapshot';
import type { AvailabilityMap } from '@/modules/catalog/garment';
import type { CommandV2, DraftV2, Impact } from '@/modules/configuration/types';

// Client state for the studio: the draft envelope from /api/studio and the
// customer catalog of every release it needs (the current one and any release
// a garment is pinned to), fetched from the immutable /api/catalog/v/{version}.
// Prices and validity are always decided by the server.

export type StudioEnvelope = {
  draft: DraftV2;
  catalogVersion: number;
  catalogUpdates: { garmentId: string; impact: Impact[] }[];
  quote: unknown;
  availability: AvailabilityMap;
};
export type PendingImpact = { command: CommandV2; impact: Impact[] };

const catalogCache = new Map<number, Promise<RuntimeIndex>>();
function loadCatalog(version: number) {
  let hit = catalogCache.get(version);
  if (!hit) {
    hit = fetch(`/api/catalog/v/${version}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('The catalog could not be loaded.');
        return indexCatalog(customerCatalogSchema.parse(await response.json()));
      })
      .catch((error) => {
        catalogCache.delete(version);
        throw error;
      });
    catalogCache.set(version, hit);
  }
  return hit;
}
const versionsOf = (envelope: StudioEnvelope) => [
  envelope.catalogVersion,
  ...envelope.draft.garments.map((garment) => garment.catalogVersion),
];

export function useStudio() {
  const [state, setState] = useState<StudioEnvelope | null>(null),
    [catalogs, setCatalogs] = useState<Record<number, RuntimeIndex>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [user, setUser] = useState<{ name: string; email: string } | null>(null),
    [mode, setMode] = useState<'guided' | 'ai'>('guided'),
    [pendingImpact, setPendingImpact] = useState<PendingImpact | null>(null);
  const lock = useRef(false);

  /** Show an envelope once every catalog it needs is loaded. */
  const accept = useCallback(async (envelope: StudioEnvelope) => {
    const versions = [...new Set(versionsOf(envelope))];
    const loaded = await Promise.all(versions.map(loadCatalog));
    setCatalogs((current) => {
      const next = { ...current };
      versions.forEach((version, i) => (next[version] = loaded[i]));
      return next;
    });
    setState(envelope);
    return envelope;
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch('/api/studio', { cache: 'no-store', signal });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error?.message || 'The studio is temporarily unavailable.');
        setUser(data.user);
        setMode(data.assistantMode);
        return await accept(data);
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load your studio.');
        return null;
      }
    },
    [accept],
  );
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/studio', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error?.message || 'The studio is temporarily unavailable.');
        setUser(data.user);
        setMode(data.assistantMode);
        return accept(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load your studio.');
      });
    return () => controller.abort();
  }, [accept]);

  const request = useCallback(
    async (endpoint: string, payload: Record<string, unknown>) => {
      if (lock.current || !state) return null;
      lock.current = true;
      setBusy(true);
      setError('');
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId: crypto.randomUUID(),
            expectedRevision: state.draft.revision,
            ...payload,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          const code = data.error?.code;
          if (code === 'impact_confirmation_required' && payload.command) {
            setPendingImpact({
              command: payload.command as CommandV2,
              impact: data.error.details?.impact ?? [],
            });
            return null;
          }
          if (response.status === 409) await load();
          throw new Error(data.error?.message || 'That change could not be saved.');
        }
        return (await accept(data)).draft;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'That change could not be saved.');
        return null;
      } finally {
        setBusy(false);
        lock.current = false;
      }
    },
    [state, load, accept],
  );
  const command = useCallback(
    (command: CommandV2) => request('/api/studio', { command }),
    [request],
  );
  return {
    state,
    draft: state?.draft ?? null,
    catalogs,
    user,
    busy,
    error,
    setError,
    mode,
    load,
    command,
    chat: (message: string) => request('/api/chat', { message }),
    pendingImpact,
    dismissImpact: () => setPendingImpact(null),
    /** Re-send the command that needed confirmation, accepting its impact. */
    confirmImpact: async () => {
      if (!pendingImpact) return null;
      const next = { ...pendingImpact.command, confirmImpact: true } as CommandV2;
      setPendingImpact(null);
      return command(next);
    },
  };
}
