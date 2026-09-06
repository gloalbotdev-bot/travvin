/**
 * AI Phase 1 — baseline regression tests (read-only contract capture).
 * Locks current InvokeLLM mock behavior + documents per-profile frontend contracts.
 *
 * Usage (from server/): npm run test:assistant-baseline
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toGeminiSchema } from '../../../src/lib/llm/gemini.js';
import { invokeLlm } from '../../../src/lib/llm/index.js';
import {
  AI_PROFILE_BASELINES,
  CURRENT_MOCK_SCHEMA_RESPONSE,
  CURRENT_MOCK_TEXT_RESPONSE,
} from './profiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });

process.env.LLM_MOCK = '1';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

function assertDeepEqual(a, b, msg) {
  assert(JSON.stringify(a) === JSON.stringify(b), msg);
}

async function main() {
  assert(AI_PROFILE_BASELINES.length === 12, 'baseline registry has 12 profiles');

  const jsonProfiles = AI_PROFILE_BASELINES.filter((p) => p.responseMode === 'json');
  const textProfiles = AI_PROFILE_BASELINES.filter((p) => p.responseMode === 'text');
  assert(jsonProfiles.length === 7, '7 structured JSON profiles');
  assert(textProfiles.length === 5, '5 plain-text profiles');

  // Freeze current generic mock shape (all schema calls share one mock today).
  const mockSchema = await invokeLlm({
    prompt: 'baseline schema probe',
    response_json_schema: jsonProfiles[0].responseJsonSchema,
  });
  assertDeepEqual(
    mockSchema,
    CURRENT_MOCK_SCHEMA_RESPONSE,
    'LLM_MOCK schema response frozen shape',
  );

  const mockText = await invokeLlm({ prompt: 'baseline text probe' });
  assert(mockText === CURRENT_MOCK_TEXT_RESPONSE, 'LLM_MOCK text response frozen string');

  for (const profile of AI_PROFILE_BASELINES) {
    if (profile.responseMode === 'text') {
      const out = await invokeLlm({ prompt: `[${profile.id}] text baseline` });
      assert(typeof out === 'string' && out.length > 0, `${profile.id}: text mode → string`);
      continue;
    }

    assert(profile.responseJsonSchema, `${profile.id}: has responseJsonSchema`);

    const gemini = toGeminiSchema(profile.responseJsonSchema);
    if (profile.geminiSchemaStrict) {
      assert(gemini?.type === 'OBJECT', `${profile.id}: schema converts for Gemini strict mode`);
    }

    const out = await invokeLlm({
      prompt: `[${profile.id}] json baseline`,
      response_json_schema: profile.responseJsonSchema,
    });
    assert(out && typeof out === 'object', `${profile.id}: schema mode → object`);

    // Document contract keys the frontend expects (may exceed current mock).
    for (const key of profile.contractKeys) {
      if (Object.prototype.hasOwnProperty.call(CURRENT_MOCK_SCHEMA_RESPONSE, key)) {
        assert(key in out, `${profile.id}: mock includes contract key "${key}"`);
      }
    }

    if (profile.actionValues?.length) {
      assert(
        Array.isArray(profile.actionValues) && profile.actionValues.length > 0,
        `${profile.id}: documents action values (${profile.actionValues.join(', ')})`,
      );
    }

    if (profile.mutationPath) {
      assert(typeof profile.mutationPath === 'string', `${profile.id}: mutation path documented`);
    }
  }

  // Customer chat action dispatch baseline (frontend switch cases).
  const customerActions = getProfileActions('customer_chat');
  assert(
    customerActions.includes('search') &&
      customerActions.includes('booking') &&
      customerActions.includes('view'),
    'customer_chat action baseline includes search/booking/view',
  );

  const ownerOps = getProfileActions('owner_assistant');
  assert(
    ownerOps.includes('create_zimmer') && ownerOps.includes('update_zimmer'),
    'owner_assistant operation baseline includes create/update zimmer',
  );

  console.log('\nProfile inventory:');
  for (const p of AI_PROFILE_BASELINES) {
    const mode = p.responseMode === 'json' ? 'JSON' : 'text';
    const mut = p.mutationPath ? 'mutates' : 'read-only';
    console.log(`  - ${p.id} (${mode}, ${mut})`);
  }

  if (failed) {
    console.error(`\n${failed} baseline assertion(s) failed`);
    process.exit(1);
  }
  console.log('\nAll assistant baseline tests passed (LLM_MOCK=1)');
}

function getProfileActions(id) {
  const p = AI_PROFILE_BASELINES.find((x) => x.id === id);
  return p?.actionValues || [];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
