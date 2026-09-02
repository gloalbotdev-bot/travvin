/**
 * SEC-001 — attachActor must not trust x-user-* headers.
 * Usage (from server/): node tests/contract/entity-authz.smoke.js
 */
import { attachActor } from '../../src/middleware/entity-authz.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

function runAttachActor(req) {
  return new Promise((resolve, reject) => {
    attachActor(req, {}, (err) => (err ? reject(err) : resolve()));
  });
}

async function main() {
  const spoofReq = {
    headers: {
      'x-user-id': '00000000-0000-0000-0000-000000000001',
      'x-user-email': 'attacker@example.com',
      'x-user-role': 'admin',
    },
  };
  await runAttachActor(spoofReq);
  assert(spoofReq.actor?.id == null, 'SEC-001 spoof headers → actor.id null');
  assert(spoofReq.actor?.email == null, 'SEC-001 spoof headers → actor.email null');
  assert(spoofReq.actor?.role == null, 'SEC-001 spoof headers → actor.role null');

  const jwtReq = {
    actor: { id: 'real-user', email: 'real@test.com', role: 'owner' },
    headers: {
      'x-user-id': '00000000-0000-0000-0000-000000000001',
      'x-user-role': 'admin',
    },
  };
  await runAttachActor(jwtReq);
  assert(jwtReq.actor.id === 'real-user', 'SEC-001 JWT actor preserved over spoof headers');

  const bareReq = { headers: {} };
  await runAttachActor(bareReq);
  assert(bareReq.actor?.role == null, 'SEC-001 no headers → anonymous actor');

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll entity-authz smoke checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
