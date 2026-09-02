/**
 * Phase 3 — customer search context/prompt/parser unit smoke.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCustomerSearchPrompt } from '../../src/lib/assistant/prompt-builder/customer-search.js';
import { parseCustomerSearchResponse } from '../../src/lib/assistant/response-parser/customer-search.js';
import { parseClientState } from '../../src/lib/assistant/context-builder/customer-search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const sampleZimmer = {
  id: 'z-test-1',
  name: 'צימר בדיקה',
  location: 'גליל עליון',
  max_guests: 4,
  num_rooms: 2,
  price_per_night: 800,
};

const sampleCtx = {
  surface: 'customer',
  availableZimmers: [sampleZimmer],
  zimmerContext: '--- צימר בדיקה (ID: z-test-1) ---',
  historyText: 'לקוח: שלום',
  datesInfo: 'תאריכי חיפוש: 2026-09-10 עד 2026-09-12, 2 מבוגרים ו-0 ילדים.',
  customerContext: '',
  contextText: 'מחפש מ-2026-09-10 עד 2026-09-12',
  dateSearchLabel: '2026-09-10 עד 2026-09-12, 2 אורחים',
  searchParams: {
    mode: 'exact',
    checkIn: '2026-09-10',
    checkOut: '2026-09-12',
    numGuests: 2,
    num_adults: 2,
    num_children: 0,
  },
  numAdults: 2,
  numChildren: 0,
};

function main() {
  const parsed = parseClientState({
    searchDates: { checkIn: '2026-09-10', checkOut: '2026-09-12', numGuests: 2 },
    recentTurns: [{ role: 'user', content: 'שלום' }],
  });
  assert(parsed.recentTurns.length === 1, 'clientState recentTurns parsed');

  const datePrompt = buildCustomerSearchPrompt('customer_date_search', sampleCtx, 'חיפוש');
  assert(datePrompt.includes('אתה בוט צימרים'), 'date search prompt has system line');
  assert(datePrompt.includes('z-test-1'), 'date search prompt includes zimmer context');

  const chatPrompt = buildCustomerSearchPrompt('customer_chat', sampleCtx, 'יש בריכה?');
  assert(chatPrompt.includes('הנחיות חובה'), 'chat prompt has rules block');
  assert(chatPrompt.includes('יש בריכה?'), 'chat prompt includes user message');

  const desktopPrompt = buildCustomerSearchPrompt(
    'customer_chat',
    { ...sampleCtx, surface: 'desktop' },
    'חפש בצפון',
  );
  assert(desktopPrompt.includes('action="view"'), 'desktop prompt allows view action');

  const searchParsed = parseCustomerSearchResponse(
    {
      action: 'search',
      message: 'מצאתי צימרים',
      zimmer_ids: ['z-test-1', 'unknown-id'],
    },
    { availableZimmers: [sampleZimmer], surface: 'customer' },
  );
  assert(searchParsed.parsed.zimmer_ids.length === 1, 'parser filters unknown zimmer ids');
  assert(
    searchParsed.uiEffects.some((e) => e.type === 'show_zimmers'),
    'search action emits show_zimmers uiEffect',
  );

  const answerParsed = parseCustomerSearchResponse(
    { action: 'answer', message: 'כן, יש בריכה' },
    { availableZimmers: [sampleZimmer], surface: 'customer' },
  );
  assert(answerParsed.uiEffects.length === 0, 'answer action has no uiEffects');

  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nAll assistant-customer unit checks passed');
  }
}

main();
