import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEntityStore } from './lib/entity-store.js';
import { createCalendarConnectionStore } from './lib/calendar-connection-store.js';
import { createDelayedJobStore } from './lib/delayed-jobs.js';
import { createEntityHooks } from './lib/entity-hooks.js';
import { createEntitiesRouter } from './routes/entities.js';
import { createAuthRouter } from './routes/auth.js';
import { createAppSettingsRouter } from './routes/app-settings.js';
import { createUsersRouter } from './routes/users.js';
import { createEventsRouter } from './routes/events.js';
import { createFunctionsRouter } from './routes/functions.js';
import { createGoogleCalendarConnectorRouter } from './routes/connectors/google-calendar-oauth.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { startCalendarAutoSyncCron } from './jobs/calendar-auto-sync.js';
import { startDelayedJobsCron } from './jobs/delayed-jobs-worker.js';
import { startStayMessagesCron } from './jobs/stay-messages-cron.js';
import { createAiRouter } from './routes/ai.js';
import { createUploadRouter } from './routes/upload.js';
import { createStorage } from './lib/storage/index.js';
import { createBookingsRouter } from './routes/bookings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const app = express();
const prisma = new PrismaClient();
const storage = createStorage();
const jobs = createDelayedJobStore(prisma);
const connections = createCalendarConnectionStore(prisma);

/** @type {ReturnType<typeof createEntityHooks> | null} */
let hooksImpl = null;
const store = createEntityStore(prisma, {
  afterCreate: (entityType, record) => hooksImpl.afterCreate(entityType, record),
  afterUpdate: (entityType, record, old) =>
    hooksImpl.afterUpdate(entityType, record, old),
});
hooksImpl = createEntityHooks({ store, jobs });

const attachAuthUser = createAuthMiddleware(prisma);
const port = Number(process.env.PORT || 3001);

const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
app.use(cors(frontendUrl ? { origin: frontendUrl, credentials: true } : {}));
app.use(express.json({ limit: '2mb' }));
app.use(attachAuthUser);

// Local-disk uploads (M11) — public read; write via /api/upload
app.use(storage.urlPrefix, express.static(storage.rootDir));

app.get('/api/health', async (_req, res) => {
  // Liveness for Render: always 200 if process is up (DB hang must not block deploy).
  let db = false;
  let error;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`.then(() => {
        db = true;
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('db_timeout')), 4000),
      ),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  res.status(200).json({
    ok: true,
    db,
    ...(error && !db ? { error } : {}),
  });
});

app.use('/api/auth', createAuthRouter(prisma));
app.use('/api/app', createAppSettingsRouter(prisma));
app.use('/api/users', createUsersRouter(prisma));
app.use('/api/entities', createEntitiesRouter(store));
app.use('/api/bookings', createBookingsRouter(prisma));
app.use('/api/events', createEventsRouter());
app.use('/api/functions', createFunctionsRouter(store, prisma));
app.use('/api/ai', createAiRouter());
app.use('/api/upload', createUploadRouter(storage));
app.use(
  '/api/connectors/google-calendar',
  createGoogleCalendarConnectorRouter(prisma, store),
);

app.listen(port, '0.0.0.0', () => {
  console.log(`[travvin-server] listening on 0.0.0.0:${port}`);
  if (process.env.CALENDAR_CRON_DISABLED === '1') {
    console.log('[calendar-auto-sync] disabled via CALENDAR_CRON_DISABLED');
  } else {
    startCalendarAutoSyncCron({ store, connections });
  }
  if (process.env.DELAYED_JOBS_DISABLED === '1') {
    console.log('[delayed-jobs] disabled via DELAYED_JOBS_DISABLED');
  } else {
    startDelayedJobsCron({ store, jobs });
  }
  if (process.env.STAY_MESSAGES_CRON_DISABLED === '1') {
    console.log('[stay-messages] disabled via STAY_MESSAGES_CRON_DISABLED');
  } else {
    startStayMessagesCron({ store });
  }
});
