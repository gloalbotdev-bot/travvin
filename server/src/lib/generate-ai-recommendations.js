/**
 * Personalized stay recommendations + interest tags on CustomerProfile.
 */
import { SERVICE_ACTOR } from './service-role.js';
import { invokeLlm } from './llm/index.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {object} payload
 * @param {import('./authz.js').Actor} actor
 */
export async function generateAIRecommendations(store, payload = {}, actor) {
  const bookingId = payload.booking_id;
  const zimmerId = payload.zimmer_id;
  const customerIdIn = payload.customer_id;
  if (!bookingId && (!zimmerId || !customerIdIn)) {
    const err = new Error('booking_id (or zimmer_id + customer_id) required');
    err.status = 400;
    throw err;
  }

  let booking = null;
  if (bookingId) {
    try {
      booking = await store.get('BookingRequest', bookingId, SERVICE_ACTOR);
    } catch {
      booking = null;
    }
  }

  if (actor?.id !== SERVICE_ACTOR.id) {
    const zId = zimmerId || booking?.zimmer_id;
    const cId = customerIdIn || booking?.created_by_id;
    const isAdmin = actor?.role === 'admin';
    const isCustomer = actor?.id && actor.id === cId;
    const isOwner = actor?.id && booking?.owner_id === actor.id;
    if (!isAdmin && !isCustomer && !isOwner) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    if (zId && actor?.role === 'owner' && !isOwner) {
      try {
        const z = await store.get('Zimmer', zId, SERVICE_ACTOR);
        if (z?.owner_id !== actor.id) {
          const err = new Error('Forbidden');
          err.status = 403;
          throw err;
        }
      } catch (e) {
        if (e.status === 403) throw e;
      }
    }
  }

  const zId = zimmerId || booking?.zimmer_id;
  const cId = customerIdIn || booking?.created_by_id;
  let zimmer = null;
  let customer = null;
  let profile = null;
  if (zId) {
    try {
      zimmer = await store.get('Zimmer', zId, SERVICE_ACTOR);
    } catch {
      /* ignore */
    }
  }
  if (cId) {
    try {
      customer = await store.get('User', cId, SERVICE_ACTOR);
    } catch {
      /* ignore */
    }
    try {
      const profiles = await store.filter('CustomerProfile', { user_id: cId }, undefined, undefined, SERVICE_ACTOR);
      profile = (profiles && profiles[0]) || null;
    } catch {
      /* ignore */
    }
  }

  let pastQuestions = [];
  let chatSummaries = [];
  try {
    pastQuestions = await store.filter('UnansweredQuestion', { created_by_id: cId }, '-created_date', 30, SERVICE_ACTOR);
  } catch {
    /* ignore */
  }
  try {
    chatSummaries = await store.filter('ChatSession', { user_id: cId }, '-updated_date', 15, SERVICE_ACTOR);
  } catch {
    /* ignore */
  }

  const location = zimmer?.location || booking?.zimmer_name || 'האזור';
  const guestName = customer?.full_name || booking?.guest_name || 'האורח';
  const checkIn = booking?.check_in || '';
  const checkOut = booking?.check_out || '';
  const numGuests = booking?.num_guests || booking?.num_adults || 0;
  const numChildren = booking?.num_children || 0;
  const preferences = profile?.vacation_preferences || '';
  const preferredRegions = profile?.preferred_regions || '';
  const knownTags = Array.isArray(profile?.interests_tags) ? profile.interests_tags : [];

  const questionsText = (pastQuestions || [])
    .filter((q) => q.question)
    .slice(0, 15)
    .map((q) => `- ${q.question}`)
    .join('\n');
  const chatSummariesText = (chatSummaries || [])
    .filter((s) => s.summary)
    .map((s) => `- ${s.summary}`)
    .join('\n');

  const prompt = `אתה עוזר נופש אישי. צור המלצות מותאמות אישית לאורח בצימר, וגם למד תחומי עניין ארוכי טווח מנתוני האורח.
פרטי השהות:
- מיקום הצימר: ${location}
- שם האורח: ${guestName}
- תאריכי שהות: ${checkIn || 'לא ידוע'} עד ${checkOut || 'לא ידוע'}
- מספר אורחים: ${numGuests}${numChildren ? ` (מהם ${numChildren} ילדים)` : ''}
- העדפות נופש: ${preferences || 'לא צוין'}
- אזורים מועדפים: ${preferredRegions || 'לא צוין'}
- תחומי עניין ידועים מהעבר: ${knownTags.length ? knownTags.join(', ') : 'אין עדיין'}

שאלות שהאורח שאל בעבר (איתות תחומי עניין):
${questionsText || '(אין)'}

סיכומי שיחות חיפוש קודמות:
${chatSummariesText || '(אין)'}

החזר JSON בלבד עם מבנה:
{
  "restaurants": [{"title":"...","description":"..."}],
  "attractions": [{"title":"...","description":"..."}],
  "trails": [{"title":"...","description":"..."}],
  "nightlife": [{"title":"...","description":"..."}],
  "activities": [{"title":"...","description":"..."}],
  "intro": "ברכת ברוכים הבאים קצרה",
  "interests_tags": ["עד 8 תגיות קצרות"]
}
כל קטגוריה: 2-4 המלצות רלוונטיות לאזור המדויק. התאם לילדים אם יש. עברית בלבד.`;

  const llmRes = await invokeLlm({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        intro: { type: 'string' },
        restaurants: { type: 'array' },
        attractions: { type: 'array' },
        trails: { type: 'array' },
        nightlife: { type: 'array' },
        activities: { type: 'array' },
        interests_tags: { type: 'array', items: { type: 'string' } },
      },
    },
  });

  const recs = llmRes && typeof llmRes === 'object' ? llmRes : {};
  const learnedTags = Array.isArray(recs.interests_tags)
    ? recs.interests_tags.map((t) => String(t)).filter(Boolean).slice(0, 8)
    : [];

  if (cId && learnedTags.length) {
    try {
      const merged = Array.from(new Set([...knownTags, ...learnedTags])).slice(0, 15);
      if (profile?.id) {
        await store.update(
          'CustomerProfile',
          profile.id,
          { interests_tags: merged, interests_updated_at: new Date().toISOString() },
          SERVICE_ACTOR,
        );
      } else {
        await store.create(
          'CustomerProfile',
          {
            user_id: cId,
            user_name: customer?.full_name || '',
            user_email: customer?.email || '',
            interests_tags: learnedTags,
            interests_updated_at: new Date().toISOString(),
          },
          { actor: SERVICE_ACTOR, createdById: SERVICE_ACTOR.id, createdBy: SERVICE_ACTOR.email },
        );
      }
    } catch {
      /* ignore persistence */
    }
  }

  return {
    ok: true,
    recommendations: {
      intro: recs.intro || '',
      restaurants: recs.restaurants || [],
      attractions: recs.attractions || [],
      trails: recs.trails || [],
      nightlife: recs.nightlife || [],
      activities: recs.activities || [],
    },
    interests_tags: learnedTags,
    context: {
      location,
      checkIn,
      checkOut,
      numGuests,
      numChildren,
      zimmerId: zId,
      customerId: cId,
      bookingId: bookingId || '',
    },
  };
}
