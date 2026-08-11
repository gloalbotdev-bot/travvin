/**
 * Seed demo data for own-backend (Supabase).
 *
 * Usage:
 *   npm run seed          # upsert demo (keeps non-demo records)
 *   npm run seed:fresh    # delete prior demo records, then seed
 *
 * Env (optional, server/.env):
 *   SEED_OWNER_EMAIL=gw38452@gmail.com
 *   SEED_CUSTOMER_EMAIL=customer.demo@travvin.local
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { buildDemoRecords } from './demo-data.js';
import { DEFAULT_CUSTOMER_EMAIL, DEFAULT_OWNER_EMAIL } from './ids.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const prisma = new PrismaClient();
const fresh = process.argv.includes('--fresh');

async function upsertUser(email, { fullName, role }) {
  const normalized = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: fullName || existing.fullName,
        role,
        registered: true,
        emailVerified: true,
      },
    });
  }
  return prisma.user.create({
    data: {
      email: normalized,
      fullName,
      role,
      registered: true,
      emailVerified: true,
    },
  });
}

async function upsertRecord(row) {
  const { id, entityType, data, createdById, createdBy } = row;
  await prisma.record.upsert({
    where: { id },
    create: {
      id,
      entityType,
      data,
      createdById,
      createdBy,
    },
    update: {
      entityType,
      data,
      createdById,
      createdBy,
    },
  });
}

async function deleteDemoRecords() {
  const deleted = await prisma.$executeRaw`
    DELETE FROM records
    WHERE data->>'_seed' = 'demo'
  `;
  return deleted;
}

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL || DEFAULT_OWNER_EMAIL;
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL || DEFAULT_CUSTOMER_EMAIL;

  console.log(`[seed] owner email: ${ownerEmail}`);
  console.log(`[seed] customer email: ${customerEmail}`);
  if (fresh) {
    const n = await deleteDemoRecords();
    console.log(`[seed] removed ${n} prior demo record(s)`);
  }

  const owner = await upsertUser(ownerEmail, {
    fullName: 'בעלים דemo',
    role: 'admin',
  });
  const customer = await upsertUser(customerEmail, {
    fullName: 'לקוח דemo',
    role: 'user',
  });

  console.log(`[seed] owner user id: ${owner.id}`);
  console.log(`[seed] customer user id: ${customer.id}`);

  const records = buildDemoRecords({
    ownerId: owner.id,
    ownerName: owner.fullName || 'בעלים דemo',
    ownerEmail: owner.email,
    customerId: customer.id,
    customerName: customer.fullName || 'לקוח דemo',
    customerEmail: customer.email,
  });

  for (const row of records) {
    await upsertRecord(row);
    console.log(`[seed] upserted ${row.entityType} ${row.id}`);
  }

  await prisma.appSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', publicSettings: {} },
    update: {},
  });

  console.log('\n[seed] Done.');
  console.log('[seed] Next: add to .env.local → VITE_BACKEND_ENTITIES=own');
  console.log('[seed] Then restart frontend and log in with Google as owner.');
}

main()
  .catch((err) => {
    console.error('[seed] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
