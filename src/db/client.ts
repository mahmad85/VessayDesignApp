import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as schema from './schema';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
export type Query = <T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<T[]>;
export type Database = {
  orm: ReturnType<typeof pgDrizzle<typeof schema>> | ReturnType<typeof localDrizzle<typeof schema>>;
  query: Query;
  transaction: <T>(fn: (query: Query) => Promise<T>) => Promise<T>;
};
const globalDB = globalThis as unknown as { vessyDB?: Promise<Database> };
export async function getDatabase(): Promise<Database> {
  if (!globalDB.vessyDB)
    globalDB.vessyDB = connect().catch((e) => {
      globalDB.vessyDB = undefined;
      throw e;
    });
  return globalDB.vessyDB;
}
async function connect(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    const query: Query = async (sql, params) => (await pool.query(sql, params)).rows;
    return {
      orm: pgDrizzle(pool, { schema }),
      query,
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(async (sql, params) => (await client.query(sql, params)).rows);
          await client.query('COMMIT');
          return result;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      },
    };
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error('DATABASE_URL is required in production.');
  const dir = process.env.VESSY_DEV_DATABASE_PATH || path.join(process.cwd(), '.data/postgres');
  await mkdir(dir, { recursive: true });
  const local = new PGlite(dir);
  await local.waitReady;
  await local.exec(
    await readFile(path.join(process.cwd(), 'migrations/0001_foundation.sql'), 'utf8'),
  );
  return {
    orm: localDrizzle(local, { schema }),
    query: async (sql, params) => (await local.query(sql, params)).rows as never,
    transaction: (fn) =>
      local.transaction(async (tx) =>
        fn(async (sql, params) => (await tx.query(sql, params)).rows as never),
      ),
  };
}
