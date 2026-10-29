/**
 * InvokeLLM facade — same contract as Base44 Core.InvokeLLM.
 * Provider: Gemini only (single GEMINI_API_KEY) — decisions.md §5.
 * { prompt, response_json_schema?, tools?, add_context_from_internet?, model?, files? }
 * → string (no schema) | object (with schema) | { message, functionCalls, model } (with tools)
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
    files: Array.isArray(payload.files) ? payload.files : [],
    tools: Array.isArray(payload.tools) ? payload.tools : [],
    fetchImpl: deps.fetchImpl,
  });
}

function mockInvoke(payload) {
  if (Array.isArray(payload.tools) && payload.tools.length) {
    return mockOwnerTools(payload);
  }
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

    if (props.recommendations) {
      return { summary: 'סיכום mock', recommendations: [] };
    }
    if (props.suggestions) {
      return { suggestions: [] };
    }
    if (props.reply) {
      return { reply: 'טיוטת mock' };
    }

    if (props.operation) {
      // Thread memory repeats earlier turns — only the latest MOCK_ token counts.
      const full = String(payload.prompt || '');
      const at = full.lastIndexOf('MOCK_');
      const prompt = at >= 0 ? full.slice(at, at + 40) : '';
      if (prompt.includes('MOCK_EXECUTE_CREATE_ZIMMER_ALT')) {
        return {
          message: 'יוצר צימר חלופי לבדיקה',
          operation: {
            type: 'create_zimmer',
            name: 'צימר Mock חלופי',
            location: 'טבריה',
            price_per_night: 560,
            num_rooms: 2,
            max_guests: 4,
          },
          actions: [],
        };
      }
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
      if (prompt.includes('MOCK_EXECUTE_BLOCK_DATES')) {
        return {
          message: 'חוסם תאריכים',
          operation: {
            type: 'block_dates',
            zimmer_name: 'צימר Mock בדיקה',
            start_date: '2031-02-10',
            end_date: '2031-02-12',
            reason: 'שיפוץ',
          },
          actions: [],
        };
      }
      if (prompt.includes('MOCK_OPEN_FORM_BLOCK')) {
        return { message: 'פותח טופס חסימה', operation: null, actions: [], open_form: 'block' };
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
      if (prompt.includes('MOCK_EXECUTE_UPDATE_BOOKING')) {
        return {
          message: 'מעדכן הזמנה',
          operation: {
            type: 'update_booking',
            guest_name: 'אורח Mock לעדכון',
            notes: 'עודכן ב-mock',
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

/** Owner assistant function-calling mock. Same MOCK_ tokens as the JSON schema mock. */
function mockOwnerTools(payload) {
  const full = String(payload.prompt || '');
  const at = full.lastIndexOf('MOCK_');
  const prompt = at >= 0 ? full.slice(at, at + 40) : '';
  const call = (message, name, args) => ({
    message,
    functionCalls: [{ name, args }],
    model: 'mock',
  });
  if (prompt.includes('MOCK_INFO_ONLY')) {
    return { message: 'יש לך 3 צימרים.', functionCalls: [], model: 'mock' };
  }
  if (prompt.includes('MOCK_ZIMMER_BUILD')) {
    return call('הנה הצימר', 'create_zimmer', {
      name: 'צימר Mock חדש',
      location: 'גליל',
      price_per_night: 500,
      weekday_price: 500,
      weekend_price: 700,
      num_rooms: 2,
      max_guests: 4,
      description: 'תיאור mock',
    });
  }
  if (prompt.includes('MOCK_EXECUTE_CREATE_ZIMMER_ALT')) {
    return call('יוצר צימר חלופי לבדיקה', 'create_zimmer', {
      name: 'צימר Mock חלופי',
      location: 'טבריה',
      price_per_night: 560,
      num_rooms: 2,
      max_guests: 4,
    });
  }
  if (prompt.includes('MOCK_EXECUTE_CREATE_ZIMMER')) {
    return call('יוצר צימר חדש לבדיקה', 'create_zimmer', {
      name: 'צימר Mock בדיקה',
      location: 'צפת',
      price_per_night: 550,
      num_rooms: 2,
      max_guests: 4,
    });
  }
  if (prompt.includes('MOCK_EXECUTE_BLOCK_DATES')) {
    return call('חוסם תאריכים', 'block_dates', {
      zimmer_name: 'צימר Mock בדיקה',
      start_date: '2031-02-10',
      end_date: '2031-02-12',
      reason: 'שיפוץ',
    });
  }
  if (prompt.includes('MOCK_OPEN_FORM_BLOCK')) {
    return call('פותח טופס חסימה', 'open_form', { form: 'block' });
  }
  if (prompt.includes('MOCK_EXECUTE_UPDATE_ZIMMER')) {
    return call('מעדכן מחיר', 'update_zimmer', {
      zimmer_id: 'REPLACE_AT_RUNTIME',
      fields: { price_per_night: 777 },
    });
  }
  if (prompt.includes('MOCK_EXECUTE_UPDATE_BOOKING')) {
    return call('מעדכן הזמנה', 'update_booking', {
      guest_name: 'אורח Mock לעדכון',
      notes: 'עודכן ב-mock',
    });
  }
  if (prompt.includes('MOCK_VALID_CREATE_ON_QUESTION')) {
    return call('אנא אשר בכרטיס האישור למטה', 'create_zimmer', {
      name: 'בקתת הארז',
      location: 'דלתון',
      price_per_night: 800,
    });
  }
  if (prompt.includes('MOCK_JUNK_STRING_ZIMMER')) {
    return call('אנא אשר בכרטיס האישור למטה', 'create_zimmer', {
      name: 'string',
      location: 'string',
      price_per_night: 100,
    });
  }
  return { message: 'תשובת mock בעברית', functionCalls: [], model: 'mock' };
}
