import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider } from './index';
export function staticPath(key: string) {
  if (
    !key.startsWith('/reference-assets/') ||
    key.includes('..') ||
    key.includes('\\') ||
    key.includes('%') ||
    !/^\/[a-zA-Z0-9_./-]+$/.test(key)
  )
    throw new Error('Invalid static media path.');
  return key;
}
export const staticStorage: StorageProvider = {
  driver: 'static',
  async put() {
    throw new Error('Static media is read-only.');
  },
  async get(key) {
    const safe = staticPath(key);
    try {
      return {
        bytes: await readFile(path.join(process.cwd(), 'public', safe)),
        contentType: safe.endsWith('.svg')
          ? 'image/svg+xml'
          : safe.endsWith('.png')
            ? 'image/png'
            : safe.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg',
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  },
};
