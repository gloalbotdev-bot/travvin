/**
 * Auth OAuth / exchange-code smoke — SEC-012, SEC-016 patterns.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthRouter } from '../../src/routes/auth.js';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { issueAuthCode } from '../../src/lib/auth-codes.js';
import { deliverOtp } from '../../src/lib/otp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const prisma = new PrismaClient();

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
  const stamp = Date.now();
  const email = `oauth-smoke-${stamp}@example.com`;
  await prisma.user.deleteMany({ where: { email } });

  const row = await prisma.user.create({
    data: {
      email,
      role: 'user',
      emailVerified: true,
      registered: true,
      fullName: 'OAuth Smoke',
    },
  });

  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware(prisma));
  app.use('/api/auth', createAuthRouter(prisma));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/api/auth`;

  const bad = await fetch(`${base}/exchange-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'not-a-real-code' }),
  });
  assert(bad.status === 400, 'invalid auth_code → 400');

  const code = issueAuthCode(row.id);
  const ok = await fetch(`${base}/exchange-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await ok.json();
  assert(ok.status === 200 && data.access_token, 'valid auth_code → JWT');
  assert(data.user?.email === email, 'exchange-code returns user');

  const reuse = await fetch(`${base}/exchange-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  assert(reuse.status === 400, 'auth_code one-time use');

  const savedNode = process.env.NODE_ENV;
  const savedAllow = process.env.ALLOW_CONSOLE_OTP;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_CONSOLE_OTP;
    const logs = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    deliverOtp(email, '123456', 'register');
    console.log = orig;
    assert(
      logs.some((l) => l.includes('withheld')),
      'SEC-016 production OTP not logged without ALLOW_CONSOLE_OTP',
    );
    assert(!logs.some((l) => l.includes('123456')), 'OTP digits not in production log');
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedAllow === undefined) delete process.env.ALLOW_CONSOLE_OTP;
    else process.env.ALLOW_CONSOLE_OTP = savedAllow;
  }

  await prisma.user.delete({ where: { id: row.id } });
  await new Promise((r) => server.close(r));

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll auth-oauth smoke tests passed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
