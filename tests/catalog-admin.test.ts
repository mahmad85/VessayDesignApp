import { describe, expect, it } from 'vitest';
import { setupTestDatabase, PGLITE_TIMEOUT } from './helpers/db';
import { bootstrapCatalog } from '../src/db/release-repository';
import {
  bulkValues,
  createStructure,
  deleteCatalogEntity,
  duplicateGroup,
  editStructure,
  listStructure,
  reorderStructure,
  setProductLink,
  setProductSettings,
} from '../src/db/catalog-structure-repository';
import { productTree } from '../src/db/catalog-working';
const database = setupTestDatabase();
const actor = 'system:test';
describe('SYNTHETIC catalog authoring WP-23–25', { timeout: PGLITE_TIMEOUT }, () => {
  it('detects stale edits, locks published codes and deletes only unused unpublished entities', async () => {
    await bootstrapCatalog();
    const [product] = await listStructure('products');
    await expect(
      editStructure(
        'products',
        String(product.id),
        { name: 'SYNTHETIC stale', rowVersion: 0 },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      editStructure(
        'products',
        String(product.id),
        { name: 'SYNTHETIC stale', rowVersion: 999 },
        actor,
      ),
    ).rejects.toMatchObject({
      code: 'stale_row_version',
      details: { current: { id: product.id } },
    });
    await expect(
      editStructure(
        'products',
        String(product.id),
        { code: 'synthetic-renamed', rowVersion: product.rowVersion },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'code_immutable' });
    await expect(deleteCatalogEntity('products', String(product.id), actor)).rejects.toMatchObject({
      code: 'entity_published',
    });
    const p = await createStructure(
      'products',
      {
        code: 'synthetic-delete',
        name: 'SYNTHETIC product',
        shortLabel: 'Test',
        measurementSet: 'shirt',
        visualModel: 'shirt',
      },
      actor,
    );
    const c = await createStructure(
      'components',
      { code: 'synthetic-part', name: 'SYNTHETIC part', visualPart: 'shirt' },
      actor,
    );
    await setProductLink(
      String(p.id),
      String(c.id),
      { required: true, defaultIncluded: true, surchargeMinor: 0 },
      actor,
    );
    await expect(deleteCatalogEntity('components', String(c.id), actor)).rejects.toMatchObject({
      code: 'entity_in_use',
    });
    const unused = await createStructure(
      'components',
      { code: 'synthetic-unused', name: 'SYNTHETIC unused', visualPart: 'shirt' },
      actor,
    );
    await deleteCatalogEntity('components', String(unused.id), actor);
    const [event] = await (
      await database()
    ).query('SELECT summary FROM audit_events WHERE entity_id=$1 ORDER BY created_at DESC', [
      unused.id,
    ]);
    expect(event.summary).toEqual({ fields: ['id'] });
  });
  it('swaps defaults, rolls back bulk failures, duplicates deeply and applies only valid product overrides', async () => {
    const db = await database();
    const [product] = await db.query("SELECT * FROM products WHERE code='shirt'");
    const [link] = await db.query('SELECT * FROM product_components WHERE product_id=$1', [
      product.id,
    ]);
    const group = await createStructure(
      'groups',
      {
        code: 'synthetic-options',
        name: 'SYNTHETIC options',
        shortName: 'Test',
        kind: 'style',
        focusRegion: 'chest',
        status: 'active',
      },
      actor,
      String(link.component_id),
    );
    const attr = await createStructure(
      'attributes',
      {
        code: 'synthetic.option',
        name: 'SYNTHETIC option',
        inputType: 'choice',
        status: 'active',
        metadataFields: [{ key: 'weight', label: 'Weight', type: 'number', required: false }],
      },
      actor,
      String(group.id),
    );
    const a = await createStructure(
      'values',
      { label: 'SYNTHETIC First', isDefault: true, status: 'active' },
      actor,
      String(attr.id),
    );
    const b = await createStructure(
      'values',
      { label: 'SYNTHETIC Second', isDefault: true, status: 'active' },
      actor,
      String(attr.id),
    );
    expect(
      (
        await db.query('SELECT id FROM option_values WHERE attribute_id=$1 AND is_default', [
          attr.id,
        ])
      ).map((x) => x.id),
    ).toEqual([b.id]);
    await expect(
      createStructure(
        'values',
        { label: 'Bad', metadata: { weight: 'not a number' } },
        actor,
        String(attr.id),
      ),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    const [before] = await db.query('SELECT * FROM option_values WHERE id=$1', [a.id]);
    await expect(
      bulkValues(
        {
          items: [
            { id: a.id, rowVersion: before.row_version, surchargeMinor: 500 },
            { id: b.id, rowVersion: 999, surchargeMinor: 1000 },
          ],
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'stale_row_version' });
    expect(
      (await db.query('SELECT surcharge_minor FROM option_values WHERE id=$1', [a.id]))[0]
        .surcharge_minor,
    ).toBe(0);
    await setProductSettings(
      String(product.id),
      {
        items: [
          {
            scope: 'attribute',
            targetId: attr.id,
            available: true,
            defaultValueId: a.id,
            surchargeOverrideMinor: 1200,
          },
          { scope: 'value', targetId: b.id, available: false },
        ],
      },
      actor,
    );
    const tree = await productTree(String(product.id));
    expect(tree.effective.attributes[String(attr.id)]).toEqual({
      available: true,
      default: a.id,
      surchargeMinor: 1200,
    });
    expect(tree.effective.values[String(b.id)].available).toBe(false);
    await expect(
      setProductSettings(
        String(product.id),
        {
          items: [{ scope: 'attribute', targetId: attr.id, available: true, defaultValueId: b.id }],
        },
        actor,
      ),
    ).rejects.toMatchObject({ code: 'validation_failed' });
    await reorderStructure({ entity: 'value', parentId: attr.id, orderedIds: [b.id, a.id] }, actor);
    expect(
      (
        await db.query('SELECT id FROM option_values WHERE attribute_id=$1 ORDER BY sort', [
          attr.id,
        ])
      ).map((r) => r.id),
    ).toEqual([b.id, a.id]);
    const copy = await duplicateGroup(
      String(group.id),
      { newCode: 'synthetic-copy', newName: 'SYNTHETIC copy' },
      actor,
    );
    const copied = await db.query('SELECT * FROM attributes WHERE group_id=$1', [copy.id]);
    expect(copied[0]).toMatchObject({ code: 'synthetic-copy.option', status: 'draft' });
    expect(
      (await db.query('SELECT * FROM option_values WHERE attribute_id=$1', [copied[0].id])).map(
        (v) => v.status,
      ),
    ).toEqual(['draft', 'draft']);
    expect(
      tree.links
        .flatMap((l) => l.component.groups)
        .find((g) => (g as Record<string, unknown>).code === 'synthetic-options')?.badges.warnings,
    ).toContain('image_missing');
  });
});
