/**
 * M10 InvokeLLM smoke — Gemini-only contract + optional live key.
 * Default: LLM_MOCK=1 when GEMINI_API_KEY missing.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toGeminiSchema, parseJsonFromLlmText } from '../../src/lib/llm/gemini.js';
import { invokeLlm } from '../../src/lib/llm/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const useMock = !process.env.GEMINI_API_KEY || process.env.LLM_MOCK === '1';
if (useMock) process.env.LLM_MOCK = '1';

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
  try {
    await invokeLlm({});
    assert(false, 'empty prompt rejected');
  } catch (e) {
    assert(e.status === 400, 'empty prompt → 400');
  }

  const text = await invokeLlm({ prompt: 'תן המלצה קצרה בעברית' });
  assert(typeof text === 'string' && text.length > 0, 'text mode returns string');

  const schema = {
    type: 'object',
    properties: {
      action: { type: 'string' },
      message: { type: 'string' },
      zimmer_ids: { type: 'array', items: { type: 'string' } },
    },
  };
  const converted = toGeminiSchema(schema);
  assert(converted?.type === 'OBJECT', 'CustomerChat-like schema converts for Gemini');

  const obj = await invokeLlm({
    prompt: 'החזר action=ask ו-message בעברית',
    response_json_schema: schema,
  });
  assert(obj && typeof obj === 'object', 'schema mode returns object');

  assert(parseJsonFromLlmText('{"a":1}').a === 1, 'parse plain JSON');
  assert(parseJsonFromLlmText('```json\n{"a":1}\n```').a === 1, 'parse fenced JSON');
  assert(parseJsonFromLlmText('{"a":1}\n`').a === 1, 'parse JSON with trailing backtick');

  const ownerFieldsSchema = {
    type: 'object',
    properties: {
      message: { type: 'string' },
      operation: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['create_zimmer', 'update_zimmer', 'create_booking'],
          },
          fields: {
            type: 'object',
            properties: {
              price_per_night: { type: 'number' },
              description: { type: 'string' },
            },
          },
        },
      },
      actions: { type: 'array', items: { type: 'string' } },
    },
  };
  const ownerConverted = toGeminiSchema(ownerFieldsSchema);
  assert(ownerConverted?.type === 'OBJECT', 'owner assistant schema converts for Gemini');

  const loose = toGeminiSchema({
    type: 'object',
    properties: {
      fields: { type: 'object', additionalProperties: true },
    },
  });
  assert(loose === null, 'additionalProperties → loose JSON path');

  const ownerLike = await invokeLlm({
    prompt: 'החזר JSON עם message',
    response_json_schema: ownerFieldsSchema,
  });
  assert(typeof ownerLike === 'object', 'owner-like schema still returns object');

  const net = await invokeLlm({
    prompt: 'test internet',
    add_context_from_internet: true,
    model: 'gemini_3_flash',
  });
  assert(typeof net === 'string', 'internet flag returns string');

  console.log(useMock ? '\n(mode: LLM_MOCK)' : '\n(mode: live Gemini)');

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll invoke-llm smoke tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
