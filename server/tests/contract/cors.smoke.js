/**
 * CORS smoke — SEC-013 production origin lock (mini app, no DB).
 */
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { getFrontendUrl } from '../../src/lib/env.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

function buildApp() {
  const app = express();
  const corsOrigin = getFrontendUrl();
  app.use(
    cors(
      corsOrigin
        ? { origin: corsOrigin, credentials: true }
        : { origin: false },
    ),
  );
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  return app;
}

function httpGet(port, origin) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        method: 'GET',
        headers: origin ? { Origin: origin } : {},
      },
      (res) => {
        res.resume();
        resolve({
          status: res.statusCode,
          allowOrigin: res.headers['access-control-allow-origin'],
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const savedNode = process.env.NODE_ENV;
  const savedFront = process.env.FRONTEND_URL;
  let server;

  try {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_URL = 'http://localhost:5173';

    const app = buildApp();
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const port = server.address().port;

    const allowed = await httpGet(port, 'http://localhost:5173');
    assert(allowed.status === 200, 'allowed origin GET → 200');
    assert(
      allowed.allowOrigin === 'http://localhost:5173',
      'allowed origin reflected in ACAO',
    );

    const blocked = await httpGet(port, 'https://evil.example');
    assert(blocked.status === 200, 'GET still 200 for blocked origin');
    assert(
      blocked.allowOrigin !== 'https://evil.example',
      'evil origin not reflected in ACAO',
    );

    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    const prodApp = buildApp();
    const prodServer = await new Promise((resolve) => {
      const s = prodApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const prodPort = prodServer.address().port;
    const prodRes = await httpGet(prodPort, 'http://localhost:5173');
    assert(prodRes.status === 200, 'prod without FRONTEND_URL still serves GET');
    assert(!prodRes.allowOrigin, 'prod missing FRONTEND_URL → no CORS');
    await new Promise((r) => prodServer.close(r));
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedFront === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = savedFront;
    if (server) await new Promise((r) => server.close(r));
  }

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll cors smoke tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
