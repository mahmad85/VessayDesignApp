import { describe, it, expect } from 'vitest';
import { advisoryContext, advisoryFindings } from '../src/modules/orders/advisory';
import { createDraft } from '../src/modules/configuration/engine';
import { indexSnapshot } from '../src/modules/catalog/snapshot';
import { newGarment } from '../src/modules/catalog/garment';
import { syntheticSnapshot, SYN } from './fixtures/catalog.synthetic';
describe('advice contract (synthetic providers, no API requests)', () => {
  const index = indexSnapshot(syntheticSnapshot()),
    draft = createDraft();
  draft.garments = [newGarment(index, SYN.suit, crypto.randomUUID())];
  draft.measurements.values = { chest: 1013 };
  draft.messages = [{ id: 'synthetic', role: 'user', text: 'PRIVATE CHAT', createdAt: '' }];
  const input = advisoryContext(draft, {
    current: index,
    releases: new Map([[index.catalog.version, index]]),
  });
  it('never includes measurements, chat or supplier data', () => {
    expect(JSON.stringify(input)).not.toMatch(/1013|PRIVATE CHAT|supplier|email|userId/);
    expect(input.measurements).toEqual({ source: 'customer', complete: false, confirmed: false });
  });
  it('cannot block or approve and bounds the output', async () => {
    for (const response of [
      {
        advice: [
          { severity: 'blocker', title: 'Stop', description: 'Do not proceed', target: 'design' },
        ],
      },
      { approved: true, advice: [] },
      { advice: Array(6).fill({ title: 'Synthetic', description: 'Advice', target: 'design' }) },
    ])
      expect(await advisoryFindings(input, async () => response)).toEqual({
        aiAdvisory: 'unavailable',
        findings: [],
      });
    const valid = await advisoryFindings(input, async () => ({
      advice: [
        {
          title: 'Synthetic advice',
          description: 'Consider fabric weight for the chosen climate.',
          target: 'design',
        },
      ],
    }));
    expect(valid.findings[0]).toMatchObject({ severity: 'advice', source: 'ai' });
  });
  it('times out without blocking the deterministic check', async () => {
    expect(await advisoryFindings(input, () => new Promise(() => {}), 5)).toEqual({
      aiAdvisory: 'unavailable',
      findings: [],
    });
    expect(await advisoryFindings(input)).toEqual({ aiAdvisory: 'not_configured', findings: [] });
  });
});
