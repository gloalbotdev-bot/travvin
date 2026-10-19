/**
 * Zimmer outdoor_area (yard) smoke — sanitize, prompt summary, owner-assistant writes, parsers.
 */
import { sanitizeOutdoorArea, outdoorAreaSummary, effectiveOutdoorItems } from '../../src/lib/outdoor-area.js';
import { executeOwnerAssistantOp } from '../../src/lib/owner-assistant-ops.js';
import { parseAdminZimmerEditorResponse, parseOwnerZimmerCreatorResponse } from '../../src/lib/assistant/response-parser/creator.js';
import { validatePayload } from '../../src/lib/schema-loader.js';
import { toGeminiSchema } from '../../src/lib/llm/gemini.js';
import { OWNER_ASSISTANT_SCHEMA } from '../../src/lib/assistant/profiles.js';

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const YARD = {
  description: 'חצר מגודרת עם דשא',
  size_sqm: 200,
  privacy: 'private',
  items: [
    { name: 'בריכה', heated: true, covered: false, size: '4x8', hours: '08:00-22:00', privacy: 'shared' },
    { name: 'מנגל', heated: null, note: '' },
    { name: '' },
    { name: 'מנגל' },
  ],
};

async function main() {
  // 1. Sanitize
  {
    const s = sanitizeOutdoorArea(YARD);
    assert(s.items.length === 2, 'empty + duplicate items dropped');
    assert(s.items[0].heated === true && s.items[0].privacy === 'shared', 'item details kept');
    assert(!('heated' in s.items[1]) && !('note' in s.items[1]), 'null/empty item fields omitted');
    assert(sanitizeOutdoorArea(undefined) === undefined, 'undefined = not sent');
    assert(sanitizeOutdoorArea({}) === null && sanitizeOutdoorArea('x') === null, 'empty/invalid → null');
    assert(sanitizeOutdoorArea({ privacy: 'public' }) === null, 'unknown privacy rejected');
  }

  // 2. Summary + legacy derivation
  {
    const line = outdoorAreaSummary({ outdoor_area: sanitizeOutdoorArea(YARD) });
    assert(line.startsWith('חצר: פרטית, 200 מ״ר'), 'summary head');
    assert(line.includes('בריכה (מחומם, 4x8, 08:00-22:00, משותף)') && line.includes('מנגל'), 'summary items');
    const legacy = { amenities: ['Wi-Fi', 'בריכה פרטית', 'מנגל'] };
    assert(effectiveOutdoorItems(legacy).map((i) => i.name).join(',') === 'בריכה פרטית,מנגל', 'legacy derives from amenities');
    assert(outdoorAreaSummary({ amenities: ['Wi-Fi'] }) === '', 'no yard → empty summary');
  }

  // 3. Entity schema accepts outdoor_area
  {
    let ok = true;
    try { validatePayload('Zimmer', { name: 'x', outdoor_area: sanitizeOutdoorArea(YARD) }); } catch { ok = false; }
    assert(ok, 'Zimmer schema validates outdoor_area');
    let rejected = false;
    try { validatePayload('Zimmer', { name: 'x', outdoor_area: { privacy: 'public' } }); } catch { rejected = true; }
    assert(rejected, 'Zimmer schema rejects bad privacy enum');
    let nullOk = true;
    try { validatePayload('Zimmer', { name: 'x', outdoor_area: null }); } catch { nullOk = false; }
    assert(nullOk, 'outdoor_area null allowed (clear)');
  }

  // 4. Owner assistant update_zimmer writes sanitized outdoor_area + amenities
  {
    const z = { id: 'z1', name: 'צימר', owner_id: 'o1' };
    const writes = [];
    const store = {
      async filter() { return [z]; },
      async get() { return z; },
      async update(_t, id, patch) { writes.push(patch); return { ...z, ...patch }; },
    };
    const actor = { id: 'o1', role: 'owner', email: 'o@x' };
    const res = await executeOwnerAssistantOp(store, {
      ownerId: 'o1',
      actor,
      operation: { type: 'update_zimmer', zimmer_id: 'z1', fields: { outdoor_area: YARD, amenities: ['מזגן', '', 'מזגן'] } },
    });
    assert(res.kind === 'update_zimmer', 'update_zimmer ok');
    assert(writes[0].outdoor_area?.items?.length === 2, 'outdoor_area sanitized on write');
    assert(JSON.stringify(writes[0].amenities) === '["מזגן"]', 'amenities deduped');
    assert(res.message.includes('מתחם חיצוני'), 'update message labels the yard');
  }

  // 5. Parsers
  {
    const ed = parseAdminZimmerEditorResponse({ action: 'update', message: 'ok', changes: { outdoor_area: YARD } });
    assert(ed.parsed.changes.outdoor_area.items.length === 2, 'editor parser keeps outdoor_area');
    const edNull = parseAdminZimmerEditorResponse({ action: 'update', message: 'ok', changes: { outdoor_area: null, description: 'd' } });
    assert(!('outdoor_area' in edNull.parsed.changes), 'editor null outdoor_area never wipes the yard');
    const cr = parseOwnerZimmerCreatorResponse({ action: 'build', message: 'ok', zimmer_data: { name: 'x', outdoor_area: YARD } });
    assert(cr.parsed.zimmer_data.outdoor_area.size_sqm === 200, 'creator parser keeps outdoor_area');
  }

  // 6. Owner assistant schema still converts for Gemini; yard fields optional
  {
    const g = toGeminiSchema(OWNER_ASSISTANT_SCHEMA);
    const fields = g?.properties?.operation?.properties?.fields;
    assert(!!fields?.properties?.outdoor_area, 'owner assistant Gemini schema has outdoor_area');
    assert(!fields.required.includes('outdoor_area') && !fields.required.includes('amenities'), 'yard fields not forced');
  }

  if (failed) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll outdoor-area smoke tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
