/**
 * env.js smoke — SEC-011, SEC-013 helpers (non-production paths).
 */
import { getFrontendUrl, getJwtSecret, isProduction } from '../../src/lib/env.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

function main() {
  const savedNode = process.env.NODE_ENV;
  const savedJwt = process.env.JWT_SECRET;
  const savedFront = process.env.FRONTEND_URL;

  try {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.FRONTEND_URL;

    assert(!isProduction(), 'isProduction false in development');
    assert(getJwtSecret() === 'dev-only-change-me', 'dev JWT fallback when unset');
    assert(getFrontendUrl() === 'http://localhost:5173', 'dev FRONTEND_URL fallback');

    process.env.JWT_SECRET = 'my-local-dev-secret-key-32chars-min';
    assert(getJwtSecret() === 'my-local-dev-secret-key-32chars-min', 'custom JWT used in dev');

    process.env.FRONTEND_URL = 'https://app.example.com/';
    assert(getFrontendUrl() === 'https://app.example.com', 'FRONTEND_URL trailing slash stripped');

    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert(getJwtSecret() === null, 'production rejects missing JWT_SECRET');
    delete process.env.FRONTEND_URL;
    assert(getFrontendUrl() === null, 'production requires FRONTEND_URL');
  } finally {
    process.env.NODE_ENV = savedNode;
    if (savedJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedJwt;
    if (savedFront === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = savedFront;
  }

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll env smoke tests passed');
}

main();
