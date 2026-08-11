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
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch (err) {
    res.status(503).json({
      ok: false,
      db: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
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

app.listen(port, () => {
  console.log(`[travvin-server] listening on http://localhost:${port}`);
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
});
