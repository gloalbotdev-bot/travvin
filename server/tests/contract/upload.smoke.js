/**
 * M11 UploadFile / storage smoke — local disk put + getUrl + HTTP upload.
 */
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import { createStorage } from '../../src/lib/storage/index.js';
import { createLocalDiskStorage } from '../../src/lib/storage/local-disk.js';
import { createUploadRouter } from '../../src/routes/upload.js';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { signToken } from '../../src/lib/jwt.js';
import { createUserStore } from '../../src/lib/user-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

async function main() {
  const tmpRoot = path.resolve(__dirname, '../../uploads/.smoke-tmp');
  await fs.rm(tmpRoot, { recursive: true, force: true });

  const storage = createLocalDiskStorage({
    rootDir: tmpRoot,
    publicBaseUrl: 'http://localhost:3001',
  });

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const { key } = await storage.put({
    key: 'smoke-pixel.png',
    body: png,
    contentType: 'image/png',
  });
  assert(key === 'smoke-pixel.png', 'put returns key');
  const url = storage.getUrl(key);
  assert(
    url === 'http://localhost:3001/uploads/smoke-pixel.png',
    `getUrl → absolute URL (${url})`,
  );
  const onDisk = await fs.readFile(path.join(tmpRoot, key));
  assert(onDisk.equals(png), 'file written to disk');

  const factory = createStorage({ publicBaseUrl: 'http://example.test' });
  assert(typeof factory.put === 'function' && typeof factory.getUrl === 'function', 'createStorage interface');

  // HTTP: auth required + UploadFile contract
  const prisma = new PrismaClient();
  const users = createUserStore(prisma);
  const email = `upload-smoke-${Date.now()}@example.com`;
  await prisma.user.deleteMany({ where: { email } });
  const row = await prisma.user.create({
    data: {
      email,
      fullName: 'Upload Smoke',
      role: 'owner',
      emailVerified: true,
      registered: true,
    },
  });
  const token = signToken(users.toAuth(row));

  const app = express();
  app.use(createAuthMiddleware(prisma));
  app.use('/uploads', express.static(tmpRoot));
  app.use('/api/upload', createUploadRouter(storage));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const unauth = await fetch(`${base}/api/upload`, { method: 'POST' });
  assert(unauth.status === 401, 'upload without auth → 401');

  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'pixel.png');
  const res = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  assert(res.ok, `upload 200 (${res.status})`);
  assert(typeof data.file_url === 'string' && data.file_url.includes('/uploads/'), 'returns { file_url }');

  // Static serve of the written key (basename from file_url)
  const uploadedKey = path.basename(new URL(data.file_url).pathname);
  const staticRes = await fetch(`${base}/uploads/${uploadedKey}`);
  assert(staticRes.ok && (await staticRes.arrayBuffer()).byteLength === png.length, 'static /uploads serves file');

  server.close();
  await prisma.user.delete({ where: { id: row.id } }).catch(() => {});
  await prisma.$disconnect();
  await fs.rm(tmpRoot, { recursive: true, force: true });

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll upload smoke tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
