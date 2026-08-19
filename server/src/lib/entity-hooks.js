/**
 * Entity workflow hooks (M9) — faithful restore of Base44 notification workflows.
 * Calendar cron is separate (M8). Google Calendar webhook skipped (decisions §2).
 * Review push notifications moved here from browser (M15 #4 #24).
 */
import { pushInAppNotification } from './push-in-app-notification.js';
import { sendGuestMessage } from './send-guest-message.js';

export function notificationsEnabled() {
  return process.env.NOTIFICATIONS_ENABLED !== 'false';
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} deps.store
 * @param {ReturnType<import('./delayed-jobs.js').createDelayedJobStore>|null} [deps.jobs]
 */
export function createEntityHooks({ store, jobs }) {
  return {
    async afterCreate(entityType, record) {
      try {
        if (entityType === 'Review') {
          await onReviewCreate(store, jobs, record);
        } else if (notificationsEnabled()) {
          if (entityType === 'BookingRequest') {
            await onNewBooking(store, record);
          } else if (entityType === 'UnansweredQuestion') {
            await onNewQuestion(store, record);
          }
        }
      } catch (err) {
        console.error('[entity-hooks] afterCreate', entityType, err);
      }
    },

    async afterUpdate(entityType, record, old) {
      if (!notificationsEnabled()) return;
      try {
        if (entityType === 'BookingRequest') {
          await onBookingUpdate(store, record, old);
        } else if (entityType === 'UnansweredQuestion') {
          await onQuestionUpdate(store, record, old);
        } else if (entityType === 'DirectChat') {
          await onDirectChatUpdate(store, record, old);
        } else if (entityType === 'Review') {
          await onReviewUpdate(store, record, old);
        }
      } catch (err) {
        console.error('[entity-hooks] afterUpdate', entityType, err);
      }
    },
  };
}

async function onNewBooking(store, data) {
  if (!data.owner_id) return;
  await pushInAppNotification(store, {
    audience: 'owner',
    target_user_ids: [data.owner_id],
    category: 'עדכון',
    title: 'בקשת הזמנה חדשה',
    body: `אורח ${data.guest_name || ''} ביקש הזמנה ל-${data.zimmer_name || ''} בתאריכים ${data.check_in || ''} עד ${data.check_out || ''}`,
    action_type: 'approve_booking',
    action_entity_id: data.id,
  });
}

async function onBookingUpdate(store, data, old) {
  const oldReason = old?.cancel_request_reason || '';
  const newReason = data.cancel_request_reason || '';
  if (newReason && !oldReason && data.owner_id) {
    await pushInAppNotification(store, {
      audience: 'owner',
      target_user_ids: [data.owner_id],
      category: 'עדכון',
      title: 'בקשת ביטול הזמנה',
      body: `הלקוח ${data.guest_name || ''} ביקש לבטל את ההזמנה ל-${data.zimmer_name || ''}. סיבה: ${newReason}`,
      action_type: 'cancel_booking',
      action_entity_id: data.id,
    });
  }

  if (
    data.status === 'אושרה' &&
    old?.status !== 'אושרה' &&
    data.created_by_id &&
    data.created_by_id !== data.owner_id
  ) {
    await pushInAppNotification(store, {
      audience: 'customer',
      target_user_ids: [data.created_by_id],
      category: 'עדכון',
      title: 'ההזמנה אושרה! 🎉',
      body: `בעל הצימר אישר את ההזמנה ל-${data.zimmer_name || ''} (${data.check_in || ''} עד ${data.check_out || ''}). לחץ לצפייה בפרטים.`,
      action_type: 'open_booking',
      action_entity_id: data.id,
    });
    try {
      await sendGuestMessage(store, {
        customer_id: data.created_by_id,
        booking_id: data.id,
        zimmer_id: data.zimmer_id,
        owner_id: data.owner_id,
        category: 'booking_confirmation',
        title: 'ההזמנה אושרה! 🎉',
        body: 'ההזמנה שלך אושרה בהצלחה. פרטי החופשה יישלחו אליך אוטומטית 24 שעות לפני ההגעה. נתראה בקרוב!',
        channels: ['app', 'whatsapp'],
        skip_bell: true,
      });
    } catch (err) {
      console.error('[entity-hooks] booking confirmation GuestMessage', err);
    }
  }

  if (
    data.status === 'נדחתה' &&
    old?.status !== 'נדחתה' &&
    data.created_by_id &&
    data.created_by_id !== data.owner_id
  ) {
    await pushInAppNotification(store, {
      audience: 'customer',
      target_user_ids: [data.created_by_id],
      category: 'עדכון',
      title: 'ההזמנה נדחתה',
      body: `בעל הצימר דחה את ההזמנה ל-${data.zimmer_name || ''} (${data.check_in || ''} עד ${data.check_out || ''}). מומלץ לחפש תאריכים או צימר אחר.`,
      action_type: 'open_booking',
      action_entity_id: data.id,
    });
  }
}

async function onNewQuestion(store, data) {
  if (!data.owner_id) return;
  await pushInAppNotification(store, {
    audience: 'owner',
    target_user_ids: [data.owner_id],
    category: 'הודעה',
    title: 'שאלה חדשה מלקוח',
    body: `שאלה עבור ${data.zimmer_name || ''}: ${data.question || ''}`,
    action_type: 'answer_question',
    action_entity_id: data.id,
  });
}

async function onQuestionUpdate(store, data, old) {
  if (data.status === 'נענתה' && old?.status !== 'נענתה' && data.created_by_id) {
    await pushInAppNotification(store, {
      audience: 'customer',
      target_user_ids: [data.created_by_id],
      category: 'הודעה',
      title: 'תשובה חדשה מבעל הצימר',
      body: `קיבלת תשובה מבעל ${data.zimmer_name || ''} לשאלתך. לחץ לקריאת התשובה.`,
      action_type: 'open_answer',
      action_entity_id: data.id,
    });
  }
}

async function onDirectChatUpdate(store, data, old) {
  const newMsgs = Array.isArray(data.messages) ? data.messages : [];
  const oldMsgs = Array.isArray(old?.messages) ? old.messages : [];
  if (newMsgs.length <= oldMsgs.length) return;
  const last = newMsgs[newMsgs.length - 1];
  if (!last) return;

  if (last.role === 'customer' && data.owner_id) {
    await pushInAppNotification(store, {
      audience: 'owner',
      target_user_ids: [data.owner_id],
      category: 'הודעה',
      title: 'הודעה חדשה מלקוח בצ\'אט',
      body: `${data.customer_name || ''} שלח לך הודעה בצ'אט על "${data.zimmer_name || ''}": ${last.content || ''}`,
      action_type: 'open_chat',
      action_entity_id: data.id,
    });
  }

  if (last.role === 'owner' && data.customer_id) {
    await pushInAppNotification(store, {
      audience: 'customer',
      target_user_ids: [data.customer_id],
      category: 'הודעה',
      title: 'תשובה חדשה מבעל הצימר בצ\'אט',
      body: `${data.owner_name || ''} ענה לך בצ'אט על "${data.zimmer_name || ''}": ${last.content || ''}`,
      action_type: 'open_chat',
      action_entity_id: data.id,
    });
  }
}

async function onReviewCreate(store, jobs, record) {
  if (notificationsEnabled() && record.owner_id) {
    await pushInAppNotification(store, {
      audience: 'owner',
      target_user_ids: [record.owner_id],
      category: 'הודעה',
      title: 'ביקורת חדשה התקבלה',
      body: `${record.rating ?? ''}/5 דירוג על ${record.zimmer_name || ''}.`,
      action_type: 'open_review',
      action_entity_id: record.id,
    });
  }

  if (!jobs) return;
  const status = record.status;
  let delayMs = null;
  if (status === 'pending_publish') delayMs = 12 * 60 * 60 * 1000;
  else if (status === 'pending_owner') delayMs = 48 * 60 * 60 * 1000;
  if (delayMs == null) return;

  const runAt = new Date(Date.now() + delayMs);
  // Dev/test override: REVIEW_WAIT_MS forces short delay
  const override = process.env.REVIEW_WAIT_MS;
  const when = override ? new Date(Date.now() + Number(override)) : runAt;

  await jobs.enqueue({
    kind: 'finalizeReviewAutoPublish',
    payload: { review_id: record.id },
    runAt: when,
  });
}

async function onReviewUpdate(store, data, old) {
  const oldStatus = old?.status;
  const newStatus = data.status;
  if (!newStatus || newStatus === oldStatus) return;

  if (newStatus === 'compromise_offered' && data.customer_id) {
    const offer = data.settlement_offer || {};
    const pct = offer.percentage != null ? `${offer.percentage}%` : '';
    const amount =
      offer.amount != null ? `${offer.amount}₪` : '';
    await pushInAppNotification(store, {
      audience: 'customer',
      target_user_ids: [data.customer_id],
      category: 'הודעה',
      title: 'הצעת פשרה על ביקורתך',
      body: `בעל ${data.zimmer_name || ''} הציע לך החזר של ${pct}${pct && amount ? ` (${amount})` : amount ? ` ${amount}` : ''} תמורת הסרת הביקורת.`,
      action_type: 'open_review',
      action_entity_id: data.id,
    });
    return;
  }

  if (
    newStatus === 'removed' &&
    oldStatus === 'compromise_offered' &&
    data.owner_id
  ) {
    await pushInAppNotification(store, {
      audience: 'owner',
      target_user_ids: [data.owner_id],
      category: 'הודעה',
      title: 'הלקוח אישר את הפשרה',
      body: `הביקורת על ${data.zimmer_name || ''} הוסרה.`,
      action_type: 'open_review',
      action_entity_id: data.id,
    });
    return;
  }

  if (
    newStatus === 'pending_owner' &&
    oldStatus === 'compromise_offered' &&
    data.owner_id
  ) {
    await pushInAppNotification(store, {
      audience: 'owner',
      target_user_ids: [data.owner_id],
      category: 'הודעה',
      title: 'הלקוח סירב לפשרה',
      body: 'הלקוח סירב להצעת הפשרה. ניתן לפרסם את הביקורת עם תגובה.',
      action_type: 'open_review',
      action_entity_id: data.id,
    });
  }
}
