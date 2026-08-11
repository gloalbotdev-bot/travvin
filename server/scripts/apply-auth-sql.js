import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const sqlPath = path.resolve(__dirname, '../prisma/sql/002_auth.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const prisma = new PrismaClient();

async function main() {
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !s.split('\n').every((line) => !line.trim() || line.trim().startsWith('--')));

  for (const statement of statements) {
    console.log('Executing:', statement.slice(0, 70).replace(/\s+/g, ' '), '…');
    await prisma.$executeRawUnsafe(statement);
  }
  console.log('Done. Auth tables ready.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
