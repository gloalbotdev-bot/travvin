/**
 * Auth smoke tests (milestone 5) — no running server required.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { signToken, verifyToken } from '../../src/lib/jwt.js';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';
import { createUserStore } from '../../src/lib/user-store.js';
import { generateOtp, saveOtp, verifyOtpCode } from '../../src/lib/otp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const prisma = new PrismaClient();
const users = createUserStore(prisma);

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
  const email = `auth-smoke-${Date.now()}@example.com`;
  const password = 'TestPass123!';
  await prisma.user.deleteMany({ where: { email } });

  const hash = await hashPassword(password);
  assert(await verifyPassword(password, hash), 'password hash round-trip');

  const row = await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      fullName: 'Smoke',
      role: 'user',
      emailVerified: true,
      registered: true,
    },
  });

  const token = signToken(users.toAuth(row));
  const claims = verifyToken(token);
  assert(claims?.id === row.id, 'JWT sign/verify');

  const invited = await users.invite(`invite-${Date.now()}@example.com`, 'owner');
  assert(invited.role === 'owner', 'inviteUser sets role');

  const updated = await users.update(row.id, { role: 'owner', phone: '050' });
  assert(updated.role === 'owner' && updated.phone === '050', 'updateMe fields (entity shape)');

  const list = await users.list('-created_date', 10);
  assert(Array.isArray(list) && list.some((u) => u.id === row.id), 'User.list');

  const code = generateOtp();
  await saveOtp(prisma, 'otp-test@example.com', code);
  assert(await verifyOtpCode(prisma, 'otp-test@example.com', code), 'OTP verify');
  assert(!(await verifyOtpCode(prisma, 'otp-test@example.com', code)), 'OTP one-time use');

  await prisma.user.delete({ where: { id: row.id } });
  await prisma.user.deleteMany({ where: { email: invited.email } });
  await prisma.otpCode.deleteMany({ where: { email: 'otp-test@example.com' } });

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll auth smoke checks passed');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
