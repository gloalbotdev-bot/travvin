/**
 * InvokeLLM facade — same contract as Base44 Core.InvokeLLM.
 * Provider: Gemini only (single GEMINI_API_KEY) — decisions.md §5.
 * { prompt, response_json_schema?, add_context_from_internet?, model? }
 * → string (no schema) | object (with schema)
 */
import { invokeGemini } from './gemini.js';

/**
 * @param {object} payload
 * @param {{ fetchImpl?: typeof fetch }} [deps]
 */
export async function invokeLlm(payload = {}, deps = {}) {
  const prompt = payload.prompt;
  if (prompt == null || String(prompt).trim() === '') {
    const err = new Error('prompt required');
    err.status = 400;
    throw err;
  }

  if (process.env.LLM_MOCK === '1') {
    return mockInvoke(payload);
  }

  return invokeGemini({
    prompt: String(prompt),
    model: payload.model,
    response_json_schema: payload.response_json_schema,
    add_context_from_internet: payload.add_context_from_internet === true,
    fetchImpl: deps.fetchImpl,
  });
}

function mockInvoke(payload) {
  if (payload.response_json_schema) {
    const props = payload.response_json_schema?.properties || {};
    const prompt = String(payload.prompt || '');

    if (props.changes) {
      if (prompt.includes('MOCK_ZIMMER_EDITOR_UPDATE')) {
        return {
          action: 'update',
          message: 'הנה השינויים המתוכננים',
          changes: {
            name: 'צימר Mock',
            price_per_night: 650,
            data_zones: [],
          },
        };
      }
      return {
        action: 'clarify',
        message: 'תשובת mock בעברית',
      };
    }

    if (props.booking) {
      if (prompt.includes('MOCK_BOOKING_CREATE')) {
        return {
          action: 'create',
          message: 'הנה ההזמנה',
          booking: {
            guest_name: 'יעקב כהן',
            guest_phone: '050-1234567',
            check_in: '2030-07-01',
            check_out: '2030-07-03',
            zimmer_name: 'Mock Zimmer',
            num_guests: 2,
            notes: '',
            status: 'אושרה',
          },
        };
      }
      return {
        action: 'ask',
        message: 'תשובת mock בעברית',
        booking: {},
      };
    }

    if (props.zimmer_data) {
      if (prompt.includes('MOCK_ZIMMER_BUILD')) {
        return {
          action: 'build',
          message: 'הנה הצימר',
          zimmer_data: {
            name: 'צימר Mock חדש',
            location: 'גליל',
            price_per_night: 500,
            weekday_price: 500,
            weekend_price: 700,
            num_rooms: 2,
            max_guests: 4,
            description: 'תיאור mock',
            data_zones: [],
          },
        };
      }
      return {
        action: 'collect',
        message: 'תשובת mock בעברית',
        zimmer_data: { name: 'Mock' },
      };
    }

    if (props.operation) {
      const prompt = String(payload.prompt || '');
      if (prompt.includes('MOCK_EXECUTE_CREATE_ZIMMER')) {
        return {
          message: 'יוצר צימר חדש לבדיקה',
          operation: {
            type: 'create_zimmer',
            name: 'צימר Mock בדיקה',
            location: 'צפת',
            price_per_night: 550,
            num_rooms: 2,
            max_guests: 4,
          },
          actions: [],
        };
      }
      if (prompt.includes('MOCK_EXECUTE_UPDATE_ZIMMER')) {
        return {
          message: 'מעדכן מחיר',
          operation: {
            type: 'update_zimmer',
            zimmer_id: 'REPLACE_AT_RUNTIME',
            fields: { price_per_night: 777 },
          },
          actions: [],
        };
      }
      return {
        message: 'תשובת mock בעברית',
        operation: null,
        actions: [],
      };
    }
    return {
      action: 'ask',
      message: 'תשובת mock בעברית',
      zimmer_ids: [],
    };
  }
  return 'תשובת mock בעברית';
}
