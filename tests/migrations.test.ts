import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import { MIGRATIONS } from '../src/db/client';
import * as schema from '../src/db/schema';
import { writeAudit } from '../src/db/audit';
import { createTestDatabaseDirectory, setupTestDatabase } from './helpers/db';

// Migration mechanics (CURRENT-SYSTEM.md): PGlite runs every file on every
// start, and scripts/migrate.ts splits files on ';' for hosted PostgreSQL.
const database = setupTestDatabase();
const migrationSql = (name: string) =>
  readFile(path.join(process.cwd(), 'migrations', `${name}.sql`), 'utf8');
const statements = (sql: string) => sql.split(';').filter((part) => part.trim());

describe('migration files', () => {
  it('split on semicolons into whole CREATE, ALTER or INSERT statements', async () => {
    for (const name of MIGRATIONS) {
      const sql = await migrationSql(name);
      expect(sql, name).not.toMatch(/\$\$|--|\/\*/);
      for (const statement of statements(sql)) {
        const text = statement.trim();
        expect(text, `${name}: ${text.slice(0, 60)}`).toMatch(/^(CREATE|ALTER|INSERT)\s/);
        expect((text.match(/\(/g) ?? []).length, text.slice(0, 60)).toBe(
          (text.match(/\)/g) ?? []).length,
        );
        expect((text.match(/'/g) ?? []).length % 2, text.slice(0, 60)).toBe(0);
      }
    }
  });

  it('run twice on one database directory, as whole files and as split statements', async () => {
    const dir = await createTestDatabaseDirectory('vessy-migrate-');
    for (let start = 0; start < 2; start++) {
      const local = new PGlite(dir);
      await local.waitReady;
      for (const name of MIGRATIONS) {
        const sql = await migrationSql(name);
        await local.exec(sql);
        for (const statement of statements(sql)) await local.query(statement);
      }
      const [{ n }] = (
        await local.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'",
        )
      ).rows;
      expect(n).toBe(40);
      const settings = await local.query('SELECT id FROM commerce_settings');
      expect(settings.rows).toHaveLength(1);
      await local.close();
    }
  });

  it('match the Drizzle mirror in src/db/schema.ts: columns, types, nullability and keys', async () => {
    const db = await database();
    const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
      is(value, PgTable),
    );
    const databaseTables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
    );
    expect(tables.map((table) => getTableConfig(table).name).sort()).toEqual(
      databaseTables.map((row) => row.table_name).sort(),
    );
    const normalise = (type: string) =>
      type
        .replace(/\(\d+(, ?\d+)?\)/, '')
        .replace('character varying', 'text')
        .replace(/^serial$/, 'integer')
        .trim();
    for (const table of tables) {
      const config = getTableConfig(table);
      const rows = await db.query<{
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
      }>(
        "SELECT column_name,data_type,udt_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [config.name],
      );
      const actual = Object.fromEntries(
        rows.map((row) => [
          row.column_name,
          {
            type: row.data_type === 'ARRAY' ? `${row.udt_name.slice(1)}[]` : row.data_type,
            notNull: row.is_nullable === 'NO',
          },
        ]),
      );
      const mirrored = Object.fromEntries(
        config.columns.map((column) => [
          column.name,
          {
            type: normalise(column.getSQLType()).replace(
              /^timestamp$/,
              'timestamp without time zone',
            ),
            notNull: column.notNull || column.primary,
          },
        ]),
      );
      expect(mirrored, config.name).toEqual(
        Object.fromEntries(
          Object.entries(actual).map(([name, value]) => [
            name,
            { ...value, type: normalise(value.type) },
          ]),
        ),
      );
      const keys = await db.query<{ column_name: string }>(
        "SELECT k.column_name FROM information_schema.table_constraints c JOIN information_schema.key_column_usage k ON k.constraint_name=c.constraint_name AND k.table_name=c.table_name WHERE c.table_schema='public' AND c.table_name=$1 AND c.constraint_type='PRIMARY KEY'",
        [config.name],
      );
      const mirroredKeys = [
        ...config.columns.filter((column) => column.primary).map((column) => column.name),
        ...config.primaryKeys.flatMap((key) => key.columns.map((column) => column.name)),
      ];
      expect(mirroredKeys.sort(), `${config.name} primary key`).toEqual(
        keys.map((key) => key.column_name).sort(),
      );
    }
  });
});

describe('catalog constraints (0003_catalog)', () => {
  const rejects = async (sql: string, params: unknown[] = []) => {
    const db = await database();
    await expect(db.query(sql, params)).rejects.toThrow(/violates|duplicate key/);
  };
  const accepts = async (sql: string, params: unknown[] = []) => {
    const db = await database();
    await db.query(sql, params);
  };
  const material =
    'INSERT INTO materials(id,code,name,super_number,usages,primary_hex) VALUES($1,$2,$3,$4,$5,$6)';

  it('keeps the super number a multiple of 10 between 60 and 250', async () => {
    await rejects(material, ['m-super-1', 'syn-super-1', 'SYNTHETIC', 125, '{shell}', '#112233']);
    await rejects(material, ['m-super-2', 'syn-super-2', 'SYNTHETIC', 260, '{shell}', '#112233']);
    await accepts(material, ['m-super-3', 'syn-super-3', 'SYNTHETIC', 120, '{shell}', '#112233']);
  });

  it('allows only the listed material usages', async () => {
    await rejects(material, ['m-usage-1', 'syn-usage-1', 'SYNTHETIC', null, '{shell,sofa}', null]);
    await accepts(material, [
      'm-usage-2',
      'syn-usage-2',
      'SYNTHETIC',
      null,
      '{shell,shirting}',
      null,
    ]);
  });

  it('requires #RRGGBB colours', async () => {
    for (const hex of ['navy', '#25374', '#25374bb', '25374b'])
      await rejects(material, [
        `m-hex-${hex}`,
        `syn-hex-${hex.replace('#', '')}`,
        'x',
        null,
        '{}',
        hex,
      ]);
    await accepts(material, ['m-hex-ok', 'syn-hex-ok', 'SYNTHETIC', null, '{}', '#25374B']);
  });

  it('allows one non-archived default choice per option', async () => {
    await accepts(
      "INSERT INTO components(id,code,name,visual_part) VALUES('c-def','syn-jacket','SYNTHETIC','jacket')",
    );
    await accepts(
      "INSERT INTO option_groups(id,code,component_id,name,short_name,kind) VALUES('g-def','syn.group','c-def','SYNTHETIC','S','style')",
    );
    await accepts(
      "INSERT INTO attributes(id,code,group_id,name,input_type) VALUES('a-def','syn.group.attr','g-def','SYNTHETIC','choice')",
    );
    const value =
      'INSERT INTO option_values(id,attribute_id,code,label,is_default,status) VALUES($1,$2,$3,$4,$5,$6)';
    await accepts(value, ['v-1', 'a-def', 'one', 'One', true, 'active']);
    await rejects(value, ['v-2', 'a-def', 'two', 'Two', true, 'draft']);
    await accepts(value, ['v-3', 'a-def', 'three', 'Three', true, 'archived']);
    await accepts(value, ['v-4', 'a-def', 'four', 'Four', false, 'active']);
    await rejects(value, ['v-5', 'a-def', 'four', 'Four again', false, 'active']);
  });

  it('keeps one product setting per target and one target per row', async () => {
    await accepts(
      "INSERT INTO products(id,code,name,short_label,measurement_set,visual_model) VALUES('p-set','syn-suit','SYNTHETIC','S','suit','suit')",
    );
    const setting =
      'INSERT INTO product_option_settings(id,product_id,scope,group_id,attribute_id,value_id,default_value_id) VALUES($1,$2,$3,$4,$5,$6,$7)';
    await accepts(setting, ['s-1', 'p-set', 'group', 'g-def', null, null, null]);
    await rejects(setting, ['s-2', 'p-set', 'group', 'g-def', null, null, null]);
    await rejects(setting, ['s-3', 'p-set', 'group', 'g-def', 'a-def', null, null]);
    await rejects(setting, ['s-4', 'p-set', 'group', 'g-def', null, null, 'v-1']);
    await accepts(setting, ['s-5', 'p-set', 'attribute', null, 'a-def', null, 'v-1']);
    await rejects(setting, ['s-6', 'p-set', 'attribute', null, 'a-def', null, null]);
    await rejects(
      "INSERT INTO products(id,code,name,short_label,measurement_set,visual_model) VALUES('p-bad','syn-bad','SYNTHETIC','S','dress','suit')",
    );
  });

  it('requires URL-slug template codes, band codes, and the single settings row', async () => {
    await accepts(
      "INSERT INTO templates(id,code,product_id,material_id,name) VALUES('t-1','wedding-navy','p-set','m-hex-ok','SYNTHETIC')",
    );
    for (const code of ['Bad Slug', 'wedding--navy', '-navy', 'navy_look'])
      await rejects(
        'INSERT INTO templates(id,code,product_id,material_id,name) VALUES($1,$2,$3,$4,$5)',
        [`t-${code}`, code, 'p-set', 'm-hex-ok', 'SYNTHETIC'],
      );
    await rejects("INSERT INTO price_bands(code,name) VALUES('band-a','SYNTHETIC')");
    await accepts("INSERT INTO price_bands(code,name) VALUES('B','SYNTHETIC')");
    await rejects("INSERT INTO commerce_settings(id) VALUES('other')");
    await rejects(
      "INSERT INTO product_components(product_id,component_id,required,default_included) VALUES('p-set','c-def',true,false)",
    );
  });
});

describe('audit writer', () => {
  it('writes an event in the same transaction as the change it records', async () => {
    const db = await database();
    const id = await db.transaction((query) =>
      writeAudit(query, {
        actor: 'system:bootstrap',
        action: 'catalog.loaded',
        entityType: 'catalog',
        summary: { fields: ['products'], after: { created: 3 } },
      }),
    );
    const [row] = await db.query(
      'SELECT actor,action,entity_type,summary FROM audit_events WHERE id=$1',
      [id],
    );
    expect(row).toMatchObject({
      actor: 'system:bootstrap',
      action: 'catalog.loaded',
      entity_type: 'catalog',
      summary: { fields: ['products'], after: { created: 3 } },
    });
    const rolledBack = crypto.randomUUID();
    await expect(
      db.transaction(async (query) => {
        await writeAudit(query, {
          actor: `user:${rolledBack}`,
          action: 'product.updated',
          entityType: 'product',
          entityId: 'p-set',
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      await db.query('SELECT id FROM audit_events WHERE actor=$1', [`user:${rolledBack}`]),
    ).toEqual([]);
  });

  it('accepts only scalar summary fields and known actor and action formats', async () => {
    const db = await database();
    const base = { actor: 'system:cli', action: 'staff.granted', entityType: 'staff' };
    await expect(
      writeAudit(db.query, {
        ...base,
        summary: { fields: ['contact'], after: { contact: { email: 'x' } } as never },
      }),
    ).rejects.toThrow();
    await expect(writeAudit(db.query, { ...base, actor: 'admin' })).rejects.toThrow();
    await expect(writeAudit(db.query, { ...base, action: 'Granted' })).rejects.toThrow();
    await expect(writeAudit(db.query, base)).resolves.toMatch(/^[0-9a-f-]{36}$/);
  });
});
