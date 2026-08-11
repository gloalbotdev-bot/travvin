import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const prisma = new PrismaClient();

const STATEMENTS = [
  `DO $$ BEGIN
  CREATE TYPE calendar_provider AS ENUM ('google');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  CREATE TYPE calendar_connection_status AS ENUM ('active', 'revoked', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider calendar_provider NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  account_email TEXT,
  scopes TEXT,
  token_expiry TIMESTAMPTZ,
  status calendar_connection_status NOT NULL,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_connections_owner_provider_key UNIQUE (owner_id, provider)
)`,
  `CREATE INDEX IF NOT EXISTS calendar_connections_owner_id_idx
  ON calendar_connections (owner_id)`,
];

async function main() {
  for (const statement of STATEMENTS) {
    console.log('Executing:', statement.slice(0, 60).replace(/\s+/g, ' '), '…');
    await prisma.$executeRawUnsafe(statement);
  }
  console.log('Done. calendar_connections ready.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
