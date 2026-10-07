/**
 * Hourly stay-message scan (cron / internal). Not a public HTTP function.
 */
import { SERVICE_ACTOR } from './service-role.js';
import { sendGuestMessage } from './send-guest-message.js';
import { generateAIRecommendations } from './generate-ai-recommendations.js';
import { israelNow } from './israel-time.js';
import {
  DEFAULT_TEMPLATES,
  buildStayVars,
  substituteVars,
  templateUses,
} from './stay-message-templates.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 */
export async function sendStayMessages(store) {
  const { now, hour, todayStr } = israelNow();
  const bookings = await store.filter(
    'BookingRequest',
    { status: 'אושרה' },
    '-created_date',
    500,
    SERVICE_ACTOR,
  );
  const results = [];

  for (const b of bookings) {
    if (!b.check_in || !b.check_out || !b.created_by_id) continue;
    const checkIn = new Date(`${b.check_in}T12:00:00`);
    const checkOut = new Date(`${b.check_out}T12:00:00`);
    const customerId = b.created_by_id;

    let zimmer = null;
    try {
      if (b.zimmer_id) zimmer = await store.get('Zimmer', b.zimmer_id, SERVICE_ACTOR);
    } catch {
      /* ignore */
    }
    const stay = zimmer?.stay_settings || {};
    // Scheduling still needs an hour when the owner left the time empty; the guest-facing
    // text shows "לא הוגדרה" instead (see buildStayVars).
    const checkinTimeStr = stay.checkin_time || '15:00';
    const checkoutTimeStr = stay.checkout_time || '11:00';
    const triggers = Array.isArray(stay.customer_triggers) ? stay.customer_triggers : [];
    const trigMap = Object.fromEntries(
      triggers
        .filter((t) => t && t.trigger)
        .map((t) => [t.trigger, { enabled: t.enabled !== false, text: String(t.text || '').trim() }]),
    );
    const trigCfg = (key) => trigMap[key] || { enabled: true, text: '' };

    const daysToCheckIn = Math.round((checkIn.getTime() - now.getTime()) / 86400000);
    const daysAfterCheckout = Math.round((now.getTime() - checkOut.getTime()) / 86400000);

    const stages = [];
    if (daysToCheckIn === 1) stages.push({ category: 'pre_checkin' });
    if (daysToCheckIn === 0) stages.push({ category: 'checkin_day' });

    if (daysToCheckIn === 0) {
      const [ciH, ciM] = String(checkinTimeStr).split(':').map((n) => parseInt(n, 10) || 0);
      if (hour === ciH) stages.push({ category: 'checkin' });
      if (hour === ((ciH + 1) % 24)) stages.push({ category: 'post_checkin' });
    }

    if (todayStr === b.check_out) {
      const [coH] = String(checkoutTimeStr).split(':').map((n) => parseInt(n, 10) || 0);
      if (hour === 9) stages.push({ category: 'morning_checkout' });
      if (hour === (coH >= 2 ? coH - 2 : 0)) stages.push({ category: 'pre_checkout' });
    }

    for (const stage of stages) {
      let already = false;
      try {
        const existing = await store.filter(
          'GuestMessage',
          { booking_id: b.id, category: stage.category },
          undefined,
          undefined,
          SERVICE_ACTOR,
        );
        already = existing && existing.length > 0;
      } catch {
        /* assume none */
      }
      if (already) {
        results.push({ booking: b.id, stage: stage.category, skipped: 'already_sent' });
        continue;
      }
      const tcfg = trigCfg(stage.category);
      if (!tcfg.enabled) {
        results.push({ booking: b.id, stage: stage.category, skipped: 'disabled' });
        continue;
      }
      const customText = tcfg.text;
      try {
        const guestName = await resolveGuestName(store, b, customerId);
        const vars = buildStayVars(stay, { ...b, zimmer_name: b.zimmer_name || zimmer?.name }, guestName);
        await dispatchStage(store, { b, stay, customerId, stage: stage.category, customText, vars });
        results.push({ booking: b.id, stage: stage.category, sent: true });
      } catch (e) {
        results.push({
          booking: b.id,
          stage: stage.category,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (daysAfterCheckout >= 1 && daysAfterCheckout <= 12) {
      let existingMsgs = [];
      try {
        existingMsgs = await store.filter(
          'GuestMessage',
          { booking_id: b.id, category: 'review_reminder' },
          undefined,
          undefined,
          SERVICE_ACTOR,
        );
      } catch {
        existingMsgs = [];
      }
      const sentCount = (existingMsgs || []).length;
      let reviews = [];
      try {
        reviews = await store.filter('Review', { booking_id: b.id }, undefined, undefined, SERVICE_ACTOR);
      } catch {
        reviews = [];
      }
      const hasReview = (reviews || []).some((r) => r.status !== 'removed');
      if (hasReview) {
        results.push({ booking: b.id, stage: 'review_reminder', skipped: 'already_reviewed' });
      } else {
        let reminderNo = 0;
        if (daysAfterCheckout >= 1 && sentCount === 0) reminderNo = 1;
        else if (daysAfterCheckout >= 5 && sentCount === 1) reminderNo = 2;
        else if (daysAfterCheckout >= 9 && sentCount === 2) reminderNo = 3;
        if (reminderNo > 0) {
          const customReviewMsg = String(stay.review_request_message || '').trim();
          let body = `מקווים שנהניתם! נשמח אם תשאירו ביקורת קצרה על השהות ב-${b.zimmer_name || 'הצימר'} — זה עוזר לאורחים הבאים ולבעל המתחם. ניתן לדרג ולכתוב דרך האזור האישי.`;
          if (reminderNo === 2) {
            body = `תזכורת שנייה 🌟 עוד לא קיבלנו את הביקורת על החופשה ב-${b.zimmer_name || 'הצימר'}. נשמח מאוד לדירוג קצר — זה לוקח רגע דרך האזור האישי.`;
          } else if (reminderNo === 3) {
            body = `תזכורת אחרונה 🙏 נשמח לשמוע על החופשה ב-${b.zimmer_name || 'הצימר'}. הביקורת שלך חשובה לנו ולאורחים הבאים. ניתן לדרג ולכתוב באזור האישי.`;
          }
          if (reminderNo === 1 && customReviewMsg) body = customReviewMsg;
          await sendGuestMessage(store, {
            customer_id: customerId,
            booking_id: b.id,
            category: 'review_reminder',
            title: `איך היתה החופשה? נשמח לביקורת 🌟`,
            body,
            channels: ['app', 'whatsapp'],
          });
          results.push({ booking: b.id, stage: 'review_reminder', sent: reminderNo });
        }
      }
    }
  }

  return { ok: true, scanned: bookings.length, results };
}

async function resolveGuestName(store, b, customerId) {
  if (b.guest_name) return b.guest_name;
  if (!customerId) return '';
  try {
    const u = await store.get('User', customerId, SERVICE_ACTOR);
    return u?.full_name || '';
  } catch {
    return '';
  }
}

/** Owner text (or the default template) with {{vars}} substituted. */
function stageText(stage, customText, vars) {
  const raw = customText && customText.trim() ? customText : DEFAULT_TEMPLATES[stage];
  return { raw, text: substituteVars(raw, vars) };
}

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ b: any, stay: any, customerId: string, stage: string, customText: string, vars: Record<string, string> }} args
 */
export async function dispatchStage(store, { b, stay, customerId, stage, customText, vars }) {
  const s = stay;
  if (stage === 'pre_checkin') {
    const address = s.address || '';
    const navLink = s.nav_link || '';
    const entryCode = s.entry_code || '';
    const keyLocation = s.key_location || '';
    const welcome = s.welcome_message || '';
    const metadata = {
      address,
      nav_link: navLink,
      instructions: keyLocation,
      key_location: keyLocation,
      entry_code: entryCode,
      checkin_time: s.checkin_time || '',
      checkout_time: s.checkout_time || '',
      phones: [],
    };
    const { raw, text } = stageText('pre_checkin', customText, vars);
    const lines = [];
    if (!templateUses(raw, 'address')) lines.push(`כתובת: ${address || 'תישלח בהמשך'}`);
    if (!templateUses(raw, 'check_in', 'checkin_time')) {
      lines.push(`שעת צ'ק-אין: ${vars.check_in} · צ'ק-אאוט: ${vars.check_out}`);
    }
    if (entryCode && !templateUses(raw, 'entry_code')) lines.push(`קוד כניסה: ${entryCode}`);
    if (keyLocation && !templateUses(raw, 'key_location')) lines.push(`מיקום מפתח/הוראות: ${keyLocation}`);
    if (navLink && !templateUses(raw, 'nav_link')) lines.push(`ניווט: ${navLink}`);
    if (welcome) lines.push(`\n${welcome}`);
    const bodyText = lines.length ? `${text}\n\n${lines.join('\n')}` : text;
    await sendGuestMessage(store, {
      customer_id: customerId,
      booking_id: b.id,
      zimmer_id: b.zimmer_id,
      owner_id: b.owner_id,
      category: 'pre_checkin',
      title: `מתקרבת החופשה שלך ב-${b.zimmer_name || 'הצימר'} 🌴`,
      body: bodyText,
      metadata,
      channels: ['app', 'whatsapp'],
    });
    return;
  }

  if (stage === 'checkin_day') {
    let recs = null;
    try {
      const r = await generateAIRecommendations(store, { booking_id: b.id }, SERVICE_ACTOR);
      recs = r?.recommendations || null;
    } catch {
      /* ignore */
    }
    const metadata = {};
    if (recs) {
      metadata.intro = recs.intro || '';
      if (recs.restaurants?.length) {
        metadata.recommendations = recs.restaurants.map((r) => ({
          category: 'restaurants',
          title: r.title,
          description: r.description,
        }));
      }
      metadata.recommendations_v2 = recs;
    }
    const missingParts = [];
    if (!b.guest_phone) missingParts.push('טלפון');
    if (!b.num_guests && !b.num_adults) missingParts.push('מספר אורחים');
    const detailsNote = missingParts.length
      ? `\n\n⚠️ שימו לב: חסרים פרטים בהזמנה (${missingParts.join(', ')}). נא להשלים דרך האזור האישי או לעדכן אותנו.`
      : '';
    await sendGuestMessage(store, {
      customer_id: customerId,
      booking_id: b.id,
      category: 'checkin_day',
      title: `חופשה נעימה ב-${b.zimmer_name || 'הצימר'}! 🎉`,
      body: stageText('checkin_day', customText, vars).text + detailsNote,
      metadata,
      channels: ['app', 'whatsapp'],
    });
    return;
  }

  if (stage === 'checkin') {
    await sendGuestMessage(store, {
      customer_id: customerId,
      booking_id: b.id,
      zimmer_id: b.zimmer_id,
      owner_id: b.owner_id,
      category: 'checkin',
      title: `צ'ק-אין בוצע — נתחיל את החופשה 🏡`,
      body: stageText('checkin', customText, vars).text,
      channels: ['app', 'whatsapp'],
    });
    return;
  }

  if (stage === 'post_checkin') {
    await sendGuestMessage(store, {
      customer_id: customerId,
      booking_id: b.id,
      zimmer_id: b.zimmer_id,
      owner_id: b.owner_id,
      category: 'post_checkin',
      title: `חופשה נעימה — אנחנו כאן לכל שאלה 😊`,
      body: stageText('post_checkin', customText, vars).text,
      channels: ['app', 'whatsapp'],
    });
    return;
  }

  if (stage === 'morning_checkout') {
    const { raw, text } = stageText('morning_checkout', customText, vars);
    const lines = [];
    if (!templateUses(raw, 'check_out', 'checkout_time')) lines.push(`שעת יציאה: ${vars.check_out}`);
    if (s.key_location && !templateUses(raw, 'key_location')) lines.push(`מיקום מפתח/הוראות: ${s.key_location}`);
    if (s.entry_code && !templateUses(raw, 'entry_code')) lines.push(`קוד יציאה: ${s.entry_code}`);
    if (s.nav_link && !templateUses(raw, 'nav_link')) lines.push(`ניווט החוצה: ${s.nav_link}`);
    let bodyText = lines.length ? `${text}\n\n${lines.join('\n')}` : text;
    bodyText += `\n\nנא להשאיר את הצימר מסודר, לצלם לפני היציאה ולבצע צ'ק-אאוט דרך האזור האישי. תודה ונשמח לראותכם שוב!`;
    await sendGuestMessage(store, {
      customer_id: customerId,
      booking_id: b.id,
      zimmer_id: b.zimmer_id,
      owner_id: b.owner_id,
      category: 'morning_checkout',
      title: `בוקר הצ'ק-אאוט — הוראות יציאה — ${b.zimmer_name || 'הצימר'}`,
      body: bodyText,
      channels: ['app', 'whatsapp'],
    });
    return;
  }

  if (stage === 'pre_checkout') {
    await sendGuestMessage(store, {
      customer_id: customerId,
      booking_id: b.id,
      category: 'pre_checkout',
      title: `תזכורת צ'ק-אאוט — ${b.zimmer_name || 'הצימר'}`,
      body: stageText('pre_checkout', customText, vars).text,
      channels: ['app', 'whatsapp'],
    });
  }
}
