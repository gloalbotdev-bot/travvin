/**
 * One-shot manual SEC HTTP checks against running server (localhost:3001).
 * Usage: node scripts/manual-sec-http-check.js
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { signToken } from '../src/lib/jwt.js';
import { createUserStore } from '../src/lib/user-store.js';
import { IDS, DEFAULT_CUSTOMER_EMAIL, DEFAULT_OWNER_EMAIL } from '../src/seed/ids.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const BASE = process.env.MANUAL_TEST_BASE || 'http://localhost:3001';
const prisma = new PrismaClient();
const users = createUserStore(prisma);

const results = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${detail}`);
}

async function req(method, urlPath, { headers = {}, body } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 120) };
  }
  return { status: res.status, json };
}

async function main() {
  try {
    await fetch(`${BASE}/api/health`);
  } catch {
    console.error(`Server not reachable at ${BASE}. Start: npm run dev:server`);
    process.exit(1);
  }

  const ownerRow = await prisma.user.findUnique({
    where: { email: DEFAULT_OWNER_EMAIL.toLowerCase() },
  });
  const customerRow = await prisma.user.findUnique({
    where: { email: DEFAULT_CUSTOMER_EMAIL.toLowerCase() },
  });

  if (!ownerRow) {
    console.warn(`No seed owner at ${DEFAULT_OWNER_EMAIL} — run: npm run seed`);
  }

  const adminTok = ownerRow ? signToken(users.toAuth(ownerRow)) : null;
  const customerTok = customerRow ? signToken(users.toAuth(customerRow)) : null;

  // SEC-006
  {
    const r = await req('POST', '/api/functions/syncGoogleCalendar', {
      body: { _from_workflow: true, owner_id: '00000000-0000-0000-0000-000000000001' },
    });
    record('SEC-006', r.status === 401, `anon _from_workflow sync → HTTP ${r.status} (expected 401)`);
  }

  // SEC-004
  {
    const list = await req('GET', '/api/entities/OwnerRequest');
    record(
      'SEC-004 list',
      list.status === 200 && Array.isArray(list.json),
      `anon GET OwnerRequest → HTTP ${list.status}, count=${Array.isArray(list.json) ? list.json.length : 'n/a'}`,
    );
    const post = await req('POST', '/api/entities/OwnerRequest', {
      body: { user_id: 'x', user_email: 'hack@test.com' },
    });
    record('SEC-004 post', post.status === 403, `anon POST OwnerRequest → HTTP ${post.status} (expected 403)`);
    if (adminTok) {
      const created = await req('POST', '/api/entities/OwnerRequest', {
        headers: { Authorization: `Bearer ${adminTok}` },
        body: {
          user_id: ownerRow.id,
          user_email: 'manual-sec@test.com',
          status: 'ממתינה',
        },
      });
      record('SEC-004 admin', created.status === 201, `admin POST OwnerRequest → HTTP ${created.status}`);
      if (created.status === 201 && created.json?.id) {
        const anonGet = await req('GET', `/api/entities/OwnerRequest/${created.json.id}`);
        record('SEC-004 get', anonGet.status === 403, `anon GET OwnerRequest/:id → HTTP ${anonGet.status}`);
        await req('DELETE', `/api/entities/OwnerRequest/${created.json.id}`, {
          headers: { Authorization: `Bearer ${adminTok}` },
        });
      }
    }
  }

  // SEC-003
  {
    const read = await req('GET', `/api/entities/Promotion/${IDS.promoActive}`);
    record('SEC-003 read', read.status === 200, `anon GET Promotion → HTTP ${read.status}`);
    const del = await req('DELETE', `/api/entities/Promotion/${IDS.promoActive}`);
    record('SEC-003 delete', del.status === 403, `anon DELETE Promotion → HTTP ${del.status} (expected 403)`);
  }

  // SEC-007
  if (customerTok && ownerRow) {
    const r = await req('POST', '/api/entities/BookingRequest', {
      headers: { Authorization: `Bearer ${customerTok}` },
      body: {
        zimmer_id: IDS.zimmerGalil,
        owner_id: '00000000-0000-0000-0000-000000000099',
        guest_name: 'ManualTest',
        guest_phone: '0500000000',
        check_in: '2026-12-01',
        check_out: '2026-12-03',
        status: 'ממתינה',
      },
    });
    record('SEC-007', r.status === 403, `forged owner_id booking → HTTP ${r.status} (expected 403)`);
  } else {
    record('SEC-007', false, 'skipped — seed users missing');
  }

  // SEC-008
  if (customerTok) {
    const r = await req('POST', '/api/entities/UnansweredQuestion', {
      headers: { Authorization: `Bearer ${customerTok}` },
      body: {
        zimmer_id: IDS.zimmerGalil,
        owner_id: '00000000-0000-0000-0000-000000000099',
        question: 'spam test',
      },
    });
    record('SEC-008', r.status === 403, `forged owner_id question → HTTP ${r.status} (expected 403)`);
  } else {
    record('SEC-008', false, 'skipped — seed customer missing');
  }

  // SEC-005
  {
    const blocked = await req('POST', '/api/ai/invoke-llm', {
      body: { prompt: 'test', add_context_from_internet: true },
    });
    record('SEC-005 internet', blocked.status === 403, `anon internet context → HTTP ${blocked.status} (expected 403)`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let okStatus = 0;
    try {
      const res = await fetch(`${BASE}/api/ai/invoke-llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'בדיקה' }),
        signal: controller.signal,
      });
      okStatus = res.status;
    } catch (e) {
      okStatus = e.name === 'AbortError' ? 0 : -1;
    } finally {
      clearTimeout(timer);
    }
    record(
      'SEC-005 guest',
      okStatus === 200 || okStatus === 503,
      okStatus === 0
        ? 'anon invoke-llm → timeout (Gemini slow; internet block already verified)'
        : `anon invoke-llm → HTTP ${okStatus}${okStatus === 503 ? ' (no API key)' : ''}`,
    );
  }

  // SEC-001 regression
  {
    const r = await req('GET', `/api/entities/ChatSession/${IDS.chatSession}`, {
      headers: {
        'x-user-id': '00000000-0000-0000-0000-000000000001',
        'x-user-email': 'attacker@example.com',
        'x-user-role': 'admin',
      },
    });
    record('SEC-001', r.status === 403, `spoof headers ChatSession → HTTP ${r.status} (expected 403)`);
  }

  // SEC-002 regression
  {
    const r = await req('GET', '/api/entities/User');
    record('SEC-002', r.status === 403, `anon GET User → HTTP ${r.status} (expected 403)`);
  }

  const failed = results.filter((x) => !x.pass);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---`);
  if (failed.length) {
    failed.forEach((f) => console.error(`  ${f.id}: ${f.detail}`));
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
