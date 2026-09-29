import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { StorageProvider } from './index';
function file(key: string) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Local media storage is disabled in production.');
  if (!/^media\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) throw new Error('Invalid media key.');
  return path.join(path.resolve(process.env.STORAGE_LOCAL_DIR || '.data/media'), ...key.split('/'));
}
export const localStorage: StorageProvider = {
  driver: 'local',
  async put(key, bytes) {
    const target = file(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
  },
  async get(key) {
    try {
      return {
        bytes: await readFile(file(key)),
        contentType: key.endsWith('.png')
          ? 'image/png'
          : key.endsWith('.jpg')
            ? 'image/jpeg'
            : 'image/webp',
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  },
};
