/**
 * HTTP integration smoke — SEC-005 invoke-llm guest caps + rate limit.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { createAiRouter, applyLlmGuestCaps } from '../../src/routes/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

process.env.LLM_MOCK = '1';
process.env.LLM_GUEST_RATE_LIMIT = '100';
process.env.LLM_AUTH_RATE_LIMIT = '100';

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
  let internetDenied = false;
  try {
    applyLlmGuestCaps({ prompt: 'hi', add_context_from_internet: true }, null);
  } catch (e) {
    internetDenied = e.status === 403;
  }
  assert(internetDenied, 'SEC-005 anon add_context_from_internet → 403');

  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware(prisma));
  app.use('/api/ai', createAiRouter());

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const ok = await fetch(`${base}/api/ai/invoke-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'שלום' }),
  });
  assert(ok.status === 410, 'SEC-005 invoke-llm deprecated → 410');
  const okBody = await ok.json();
  assert(okBody.code === 'DEPRECATED', 'invoke-llm returns DEPRECATED code');

  const blocked = await fetch(`${base}/api/ai/invoke-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'test',
      add_context_from_internet: true,
    }),
  });
  assert(blocked.status === 410, 'SEC-005 deprecated route blocks all invoke-llm calls');

  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  await prisma.$disconnect();

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll ai-http smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
