/**

 * HTTP smoke — assistant API (/api/assistant/chat).

 */

import dotenv from 'dotenv';

import path from 'node:path';

import { fileURLToPath } from 'node:url';

import express from 'express';

import { PrismaClient } from '@prisma/client';

import { createAuthMiddleware } from '../../src/middleware/auth.js';

import { createAssistantRouter } from '../../src/routes/assistant.js';

import { createEntityStore } from '../../src/lib/entity-store.js';

import { signToken } from '../../src/lib/jwt.js';

import { createUserStore } from '../../src/lib/user-store.js';

import { SERVICE_ACTOR } from '../../src/lib/service-role.js';



const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });



process.env.LLM_MOCK = '1';

process.env.ASSISTANT_GUEST_RATE_LIMIT = '100';

process.env.ASSISTANT_AUTH_RATE_LIMIT = '100';



const prisma = new PrismaClient();

const store = createEntityStore(prisma);

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

  const stamp = Date.now();

  const ownerEmail = `asst-owner-${stamp}@example.com`;

  const customerEmail = `asst-cust-${stamp}@example.com`;



  await prisma.user.deleteMany({

    where: { email: { in: [ownerEmail, customerEmail] } },

  });



  const ownerRow = await prisma.user.create({

    data: { email: ownerEmail, role: 'owner', registered: true, emailVerified: true },

  });

  const customerRow = await prisma.user.create({

    data: { email: customerEmail, role: 'user', registered: true, emailVerified: true },

  });



  const zimmer = await store.create(

    'Zimmer',

    {

      name: `Assistant Test ${stamp}`,

      location: 'גליל עליון',

      approval_status: 'אושר',

      max_guests: 4,

      price_per_night: 900,

      owner_id: ownerRow.id,

    },

    { actor: SERVICE_ACTOR },

  );



  const app = express();

  app.use(express.json());

  app.use(createAuthMiddleware(prisma));

  app.use('/api/assistant', createAssistantRouter({ prisma, store }));



  const server = await new Promise((resolve) => {

    const s = app.listen(0, '127.0.0.1', () => resolve(s));

  });

  const { port } = server.address();

  const base = `http://127.0.0.1:${port}`;



  const profilesRes = await fetch(`${base}/api/assistant/profiles`);

  assert(profilesRes.status === 200, 'GET /profiles → 200');

  const profilesBody = await profilesRes.json();

  assert(Array.isArray(profilesBody.profiles) && profilesBody.profiles.length === 12, '12 profiles listed');



  const guestOk = await fetch(`${base}/api/assistant/chat`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({

      profile: 'customer_chat',

      message: 'שלום, יש צימרים בצפון?',

      clientState: {

        searchDates: {

          checkIn: '2030-06-01',

          checkOut: '2030-06-03',

          numGuests: 2,

          num_adults: 2,

          num_children: 0,

        },

      },

    }),

  });

  assert(guestOk.status === 200, 'guest customer_chat → 200');

  const guestBody = await guestOk.json();

  assert(guestBody.meta?.phase === 5, 'guest customer_chat is Phase 5');

  assert(guestBody.meta?.profile === 'customer_chat', 'guest response profile echoed');

  assert(typeof guestBody.message?.content === 'string', 'guest response has assistant message');

  assert(guestBody.meta?.parsed?.action, 'guest response includes parsed LLM action');



  const dateSearchOk = await fetch(`${base}/api/assistant/chat`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({

      profile: 'customer_date_search',

      message: '🔍 חיפוש תאריכים',

      clientState: {

        searchParams: {

          mode: 'exact',

          checkIn: '2030-06-01',

          checkOut: '2030-06-03',

          numGuests: 2,

          num_adults: 2,

          num_children: 0,

        },

      },

    }),

  });

  assert(dateSearchOk.status === 200, 'guest customer_date_search → 200');

  const dateBody = await dateSearchOk.json();

  assert(dateBody.meta?.phase === 5, 'date search is Phase 5');



  const dateSearchMissing = await fetch(`${base}/api/assistant/chat`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({

      profile: 'customer_date_search',

      message: 'חיפוש',

    }),

  });

  assert(dateSearchMissing.status === 400, 'customer_date_search without searchParams → 400');



  const guestDenied = await fetch(`${base}/api/assistant/chat`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({

      profile: 'owner_assistant',

      message: 'שלום',

    }),

  });

  assert(guestDenied.status === 401, 'guest owner_assistant → 401');



  const forbiddenField = await fetch(`${base}/api/assistant/chat`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({

      profile: 'customer_chat',

      message: 'שלום',

      prompt: 'hack',

    }),

  });

  assert(forbiddenField.status === 400, 'forbidden prompt field → 400');



  const ownerTok = signToken(users.toAuth(ownerRow));

  const ownerOk = await fetch(`${base}/api/assistant/chat`, {

    method: 'POST',

    headers: {

      Authorization: `Bearer ${ownerTok}`,

      'Content-Type': 'application/json',

    },

    body: JSON.stringify({

      profile: 'owner_assistant',

      message: 'מה ההזמנות?',

      clientState: { mode: 'info' },

    }),

  });

  assert(ownerOk.status === 200, 'owner owner_assistant → 200');

  const ownerBody = await ownerOk.json();

  assert(ownerBody.meta?.phase === 6, 'owner_assistant is Phase 6');
  assert(ownerBody.meta?.stub !== true, 'owner_assistant no longer stub');



  const customerTok = signToken(users.toAuth(customerRow));

  const customerDenied = await fetch(`${base}/api/assistant/chat`, {

    method: 'POST',

    headers: {

      Authorization: `Bearer ${customerTok}`,

      'Content-Type': 'application/json',

    },

    body: JSON.stringify({

      profile: 'owner_assistant',

      message: 'hack',

    }),

  });

  assert(customerDenied.status === 403, 'customer owner_assistant → 403');



  const unknownProfile = await fetch(`${base}/api/assistant/chat`, {

    method: 'POST',

    headers: { 'Content-Type': 'application/json' },

    body: JSON.stringify({

      profile: 'does_not_exist',

      message: 'x',

    }),

  });

  assert(unknownProfile.status === 400, 'unknown profile → 400');



  await new Promise((resolve, reject) => {

    server.close((err) => (err ? reject(err) : resolve()));

  });



  await store.delete('Zimmer', zimmer.id, { actor: SERVICE_ACTOR }).catch(() => {});

  await prisma.user.deleteMany({

    where: { email: { in: [ownerEmail, customerEmail] } },

  });

  await prisma.$disconnect();



  if (failed) {

    console.error(`\n${failed} assertion(s) failed`);

    process.exitCode = 1;

  } else {

    console.log('\nAll assistant-http smoke checks passed');

  }

}



main().catch((err) => {

  console.error(err);

  process.exitCode = 1;

});


