/**
 * Abstract file storage (M11). Swap implementation via STORAGE_DRIVER later (e.g. S3).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalDiskStorage } from './local-disk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {{ publicBaseUrl?: string }} [opts]
 */
export function createStorage(opts = {}) {
  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  const publicBaseUrl =
    opts.publicBaseUrl ||
    process.env.PUBLIC_API_URL ||
    `http://localhost:${process.env.PORT || 3001}`;

  if (driver === 'local' || driver === 'local-disk') {
    const rootDir =
      process.env.STORAGE_LOCAL_DIR ||
      path.resolve(__dirname, '../../../uploads');
    return createLocalDiskStorage({ rootDir, publicBaseUrl });
  }

  throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
}
