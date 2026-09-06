/**
 * Customer ChatSession write paths — append + split (ported from Base44).
 */
import { SERVICE_ACTOR } from './service-role.js';
import { invokeLlm } from './llm/index.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 * @param {import('./authz.js').Actor} actor
 */
export async function appendChatMessage(store, payload = {}, actor) {
  if (!actor?.id) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const {
    session_id,
    messages,
    zimmer_ids,
    booking_created,
    user_name,
    user_email,
  } = payload;

  const msgDocs = Array.isArray(messages)
    ? messages
        .filter((m) => m && m.content)
        .map((m) => ({ role: m.role, content: m.content, time: m.time || '' }))
    : [];
  const zimmerIds = Array.isArray(zimmer_ids) ? zimmer_ids : [];

  const data = {
    user_id: actor.id,
    user_name: user_name || actor.full_name || '',
    user_email: user_email || actor.email || '',
    messages: msgDocs,
    zimmer_ids_shown: [...new Set(zimmerIds)],
    booking_created: !!booking_created,
  };

  if (session_id) {
    const existing = await store.get('ChatSession', session_id, SERVICE_ACTOR);
    if (existing.locked) {
      const err = new Error('locked');
      err.status = 409;
      throw err;
    }
    if (existing.user_id !== actor.id && actor.role !== 'admin') {
      const err = new Error('forbidden');
      err.status = 403;
      throw err;
    }
    const updated = await store.update('ChatSession', session_id, data, SERVICE_ACTOR);
    return { session_id: updated.id };
  }

  const created = await store.create('ChatSession', data, actor);
  return { session_id: created.id };
}

async function summarizeMessages(messages) {
  const lines = (messages || [])
    .slice(-50)
    .map((m) => `${m.role || 'user'}: ${m.content || ''}`)
    .join('\n');
  if (!lines.trim()) {
    return { summary: '', title: '' };
  }
  try {
    const res = await invokeLlm({
      prompt: `סכם בעברית את השיחה הבאה בין 2-4 משפטים, והחזר JSON עם summary ו-title קצר:\n${lines}`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          title: { type: 'string' },
        },
      },
    });
    return {
      summary: res?.summary || '',
      title: res?.title || '',
    };
  } catch {
    return { summary: '', title: '' };
  }
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 * @param {import('./authz.js').Actor} actor
 */
export async function splitCustomerChat(store, payload = {}, actor) {
  if (!actor?.id) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const { session_id } = payload;
  if (!session_id) {
    const err = new Error('session_id required');
    err.status = 400;
    throw err;
  }

  const session = await store.get('ChatSession', session_id, SERVICE_ACTOR);
  if (session.user_id !== actor.id && actor.role !== 'admin') {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }
  if (session.locked) {
    const err = new Error('already locked');
    err.status = 409;
    throw err;
  }

  const messages = Array.isArray(session.messages) ? session.messages : [];
  let { summary, title } = await summarizeMessages(messages);
  if (!summary) {
    summary =
      'המשך מאיפה שעצרנו — שיחה קודמת הסתיימה. הנה מה שכבר ידוע מההקשר הקודם.';
    title = 'שיחה קודמת';
  }

  await store.update(
    'ChatSession',
    session_id,
    { locked: true, title },
    SERVICE_ACTOR,
  );

  const nowTime = new Date().toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const openingContent = `המשך מאיפה שעצרנו — הנה מה שכבר ידוע מהשיחה הקודמת:\n${summary}`;

  const newSession = await store.create(
    'ChatSession',
    {
      user_id: actor.id,
      user_name: actor.full_name || session.user_name || '',
      user_email: actor.email || session.user_email || '',
      messages: [{ role: 'assistant', content: openingContent, time: nowTime }],
      zimmer_ids_shown: [],
      booking_created: false,
      summary,
      title,
    },
    actor,
  );

  return {
    new_session_id: newSession.id,
    summary,
    title,
    opening_content: openingContent,
  };
}
