/**
 * Local-disk storage — files on disk, URLs via static /uploads.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {{ rootDir: string, publicBaseUrl: string, urlPrefix?: string }} opts
 */
export function createLocalDiskStorage({
  rootDir,
  publicBaseUrl,
  urlPrefix = '/uploads',
}) {
  const prefix = urlPrefix.replace(/\/$/, '') || '/uploads';
  const base = publicBaseUrl.replace(/\/$/, '');

  return {
    /**
     * @param {{ key: string, body: Buffer | Uint8Array, contentType?: string }} input
     */
    async put({ key, body }) {
      const safeKey = path.basename(String(key || ''));
      if (!safeKey || safeKey === '.' || safeKey === '..') {
        const err = new Error('Invalid storage key');
        err.status = 400;
        throw err;
      }
      await fs.mkdir(rootDir, { recursive: true });
      const dest = path.join(rootDir, safeKey);
      await fs.writeFile(dest, Buffer.from(body));
      return { key: safeKey };
    },

    /** Absolute URL the frontend can store in images / review photos. */
    getUrl(key) {
      const safeKey = path.basename(String(key || ''));
      return `${base}${prefix}/${encodeURIComponent(safeKey)}`;
    },

    get rootDir() {
      return rootDir;
    },

    get urlPrefix() {
      return prefix;
    },
  };
}
