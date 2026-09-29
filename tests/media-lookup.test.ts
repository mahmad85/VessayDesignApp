import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { createSyntheticUser } from './helpers/users';
import { apiRequest } from './helpers/http';
import { grantRole } from '../src/db/staff-repository';
import { seedLookupTypes } from '../src/db/catalog-admin-repository';
import { LOOKUP_TYPES } from '../src/modules/catalog/lookup-seeds';
import { imageInfo, UPLOAD_MAX, uploadForm } from '../src/modules/catalog/media-upload';
import { getStorage } from '../src/integrations/storage';
import { staticPath } from '../src/integrations/storage/static';
import { addLookup, editLookup, orderLookups, getLookups } from '../src/db/lookup-repository';
import { POST as upload, GET as list } from '../src/app/api/admin/media/route';
import { PATCH as edit } from '../src/app/api/admin/media/[id]/route';
import { GET as serve } from '../src/app/api/media/[id]/route';
const database = setupTestDatabase();
afterEach(() => vi.unstubAllEnvs());
const fixture = (ext: string) => readFile(`tests/fixtures/media/synthetic-64.${ext}`);
describe('SYNTHETIC catalog media and lists (WP-22)', { timeout: PGLITE_TIMEOUT }, () => {
  it('accepts real PNG/JPEG/WebP headers; rejects SVG, spoofed type, size and dimensions', async () => {
    for (const [ext, type] of [
      ['png', 'image/png'],
      ['jpg', 'image/jpeg'],
      ['webp', 'image/webp'],
    ])
      expect(imageInfo(await fixture(ext), `synthetic.${ext}`, type)).toMatchObject({
        width: 64,
        height: 64,
        contentType: type,
      });
    expect(() => imageInfo(Buffer.from('<svg/>'), 'synthetic.svg', 'image/svg+xml')).toThrow();
    const png = await fixture('png');
    expect(() => imageInfo(png, 'spoof.jpg', 'image/jpeg')).toThrow(/match/);
    expect(() => imageInfo(Buffer.alloc(UPLOAD_MAX + 1), 'large.png', 'image/png')).toThrow(
      /5 MiB/,
    );
    const tooSmall = Buffer.from(png);
    tooSmall.writeUInt32BE(63, 16);
    expect(() => imageInfo(tooSmall, 'small.png', 'image/png')).toThrow(/64 and 8000/);
    const tooBig = Buffer.from(png);
    tooBig.writeUInt32BE(8001, 20);
    expect(() => imageInfo(tooBig, 'big.png', 'image/png')).toThrow(/64 and 8000/);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(UPLOAD_MAX + 1));
        controller.close();
      },
    });
    await expect(
      uploadForm(
        new Request('http://localhost/upload', {
          method: 'POST',
          body: stream,
          duplex: 'half',
        } as RequestInit),
      ),
    ).rejects.toMatchObject({ code: 'upload_too_large', status: 413 });
    expect(() => staticPath('//evil.example/image.png')).toThrow();
    expect(() => staticPath('/reference-assets/../private')).toThrow();
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => getStorage('local')).toThrow();
    await expect(getStorage('static').put('key', new Uint8Array(), 'image/png')).rejects.toThrow(
      /read-only/,
    );
  });
  it('authorizes, deduplicates, audits, versions metadata and serves immutable raster bytes', async () => {
    vi.stubEnv('STAFF_MFA_REQUIRED', 'false');
    vi.stubEnv('STORAGE_LOCAL_DIR', await mkdtemp(path.join(tmpdir(), 'vessy-media-')));
    const user = await createSyntheticUser();
    await grantRole({ email: user.email, role: 'catalog_manager' }, 'system:test');
    const form = () => {
      const data = new FormData();
      data.append('file', new File([Uint8Array.from(png)], 'synthetic.png', { type: 'image/png' }));
      data.append('altText', 'SYNTHETIC green square');
      data.append('rightsStatus', 'owned');
      return data;
    };
    const png = await fixture('png');
    const request = (cookie?: string) =>
      new NextRequest('http://localhost:3000/api/admin/media', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000', cookie: cookie || '' },
        body: form(),
      });
    expect((await upload(request())).status).toBe(401);
    const response = await upload(request(user.cookie));
    expect(response.status).toBe(201);
    const media = await response.json();
    const duplicate = await (await upload(request(user.cookie))).json();
    expect(duplicate.id).toBe(media.id);
    const output = await serve(apiRequest(media.url), {
      params: Promise.resolve({ id: media.id }),
    });
    expect(output.status).toBe(200);
    expect(Buffer.from(await output.arrayBuffer())).toEqual(png);
    expect(output.headers.get('cache-control')).toContain('immutable');
    expect(output.headers.get('x-content-type-options')).toBe('nosniff');
    expect(output.headers.get('content-security-policy')).toBe("default-src 'none'");
    const edited = await edit(
      apiRequest(media.url, {
        method: 'PATCH',
        cookies: user.cookie,
        json: { rowVersion: 1, altText: 'SYNTHETIC changed' },
      }),
      { params: Promise.resolve({ id: media.id }) },
    );
    expect(edited.status).toBe(200);
    const stale = await edit(
      apiRequest(media.url, {
        method: 'PATCH',
        cookies: user.cookie,
        json: { rowVersion: 1, altText: 'SYNTHETIC stale' },
      }),
      { params: Promise.resolve({ id: media.id }) },
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.details.current.altText).toBe('SYNTHETIC changed');
    expect(
      (
        await (
          await list(apiRequest('/api/admin/media?query=SYNTHETIC', { cookies: user.cookie }))
        ).json()
      ).items,
    ).toHaveLength(1);
    const audits = await (
      await database()
    ).query("SELECT action FROM audit_events WHERE entity_type='media_assets' AND entity_id=$1", [
      media.id,
    ]);
    expect(audits.map((r) => r.action)).toEqual(['media_assets.create', 'media_assets.update']);
  });
  it('validates lookup metadata, locks codes, checks row versions and reorders exactly one list', async () => {
    const db = await database();
    await seedLookupTypes(db.query, LOOKUP_TYPES);
    await expect(
      addLookup(
        'colour_family',
        { code: 'synthetic-green', label: 'SYNTHETIC Green', metadata: { hex: 'bad' } },
        'system:test',
      ),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    const one = await addLookup(
      'colour_family',
      { code: 'synthetic-green', label: 'SYNTHETIC Green', metadata: { hex: '#28503c' } },
      'system:test',
    );
    const two = await addLookup(
      'colour_family',
      { code: 'synthetic-blue', label: 'SYNTHETIC Blue', metadata: { hex: '#285080' } },
      'system:test',
    );
    await db.query('UPDATE lookup_values SET first_published_version=1 WHERE id=$1', [one.id]);
    await expect(
      editLookup(String(one.id), { rowVersion: 1, code: 'changed' }, 'system:test'),
    ).rejects.toThrow();
    await editLookup(
      String(one.id),
      { rowVersion: 1, label: 'SYNTHETIC green renamed', active: false },
      'system:test',
    );
    await expect(
      editLookup(String(one.id), { rowVersion: 1, label: 'stale' }, 'system:test'),
    ).rejects.toMatchObject({ code: 'stale_row_version' });
    await expect(
      orderLookups('colour_family', { orderedIds: [one.id] }, 'system:test'),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    await orderLookups('colour_family', { orderedIds: [two.id, one.id] }, 'system:test');
    const result = await getLookups();
    const type = result.types.find((t) => t.code === 'colour_family')!;
    expect(type.system).toBe(true);
    expect(type.values.map((v) => v.id)).toEqual([two.id, one.id]);
    expect(type.values[1].active).toBe(false);
  });
});
