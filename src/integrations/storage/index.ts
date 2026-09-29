import { localStorage } from './local';
import { staticStorage } from './static';
export interface StorageProvider {
  driver: 'local' | 'object_store' | 'static';
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}
export function getStorage(driver = process.env.STORAGE_DRIVER || 'local'): StorageProvider {
  if (driver === 'static') return staticStorage;
  if (driver === 'local' && process.env.NODE_ENV !== 'production') return localStorage;
  throw new Error('Production catalog storage is not configured (Q-024).');
}
