/**
 * Hourly supplier automation dispatcher (cron / internal).
 */
import { SERVICE_ACTOR } from './service-role.js';
import { sendSupplierMessage } from './send-supplier-message.js';
import { israelNow } from './israel-time.js';

const WINDOW_DAYS = { weekly: 7, biweekly: 14, monthly: 30 };

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 */
export async function sendScheduledSupplierMessages(store) {
  const { now, hour, day, dow, todayStr } = israelNow();

  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const isoWeek =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  const weekEven = isoWeek % 2 === 0;

  let automations = [];
  try {
    automations = await store.filter(
      'SupplierAutomation',
      { enabled: true },
      '-created_date',
      1000,
      SERVICE_ACTOR,
    );
  } catch {
    automations = [];
  }
  const scheduled = (automations || []).filter(
    (a) => a.message_type === 'weekly_cleaning' || a.message_type === 'daily_laundry',
  );

  const results = [];
  for (const a of scheduled) {
    const t = (a.time || '').split(':');
    const aHour = t.length === 2 ? parseInt(t[0], 10) : -1;
    if (aHour !== hour) continue;
    const freq = a.frequency || 'weekly';
    let matches = false;
    if (freq === 'weekly') matches = a.day_of_week === dow;
    else if (freq === 'biweekly') matches = a.day_of_week === dow && weekEven;
    else if (freq === 'monthly') matches = a.month_day === day;
    if (!matches) continue;

    if (a.last_sent_at) {
      const diffMin = (now.getTime() - new Date(a.last_sent_at).getTime()) / 60000;
      if (diffMin < 90) continue;
    }

    try {
      const res = await dispatchAutomation(store, a, todayStr);
      try {
        await store.update('SupplierAutomation', a.id, { last_sent_at: now.toISOString() }, SERVICE_ACTOR);
      } catch {
        /* ignore */
      }
      results.push({
        automation: a.id,
        message_type: a.message_type,
        sent: res.sent,
        delivery: res.delivery,
        error: res.error,
      });
    } catch (e) {
      results.push({ automation: a.id, sent: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { ok: true, now: todayStr, hour, dow, week_even: weekEven, results };
}

async function dispatchAutomation(store, a, todayStr) {
  let zids = Array.isArray(a.zimmer_ids) ? a.zimmer_ids : [];
  if (zids.length === 0) {
    try {
      const oz = await store.filter('Zimmer', { owner_id: a.owner_id }, 'name', 1000, SERVICE_ACTOR);
      zids = (oz || []).map((z) => z.id);
    } catch {
      zids = [];
    }
  }
  if (zids.length === 0) return { sent: false };

  let contact = null;
  try {
    contact = await store.get('Contact', a.contact_id, SERVICE_ACTOR);
  } catch {
    /* ignore */
  }
  if (!contact || !contact.phone) return { sent: false };

  let bookings = [];
  try {
    bookings = await store.filter('BookingRequest', { status: 'אושרה' }, '-created_date', 1000, SERVICE_ACTOR);
  } catch {
    bookings = [];
  }

  const windowDays = WINDOW_DAYS[a.frequency || 'weekly'] || 7;
  const endStr = new Date(Date.now() + windowDays * 86400000).toISOString().slice(0, 10);
  const inWindow = (s) => s && s >= todayStr && s <= endStr;

  if (a.message_type === 'weekly_cleaning') {
    const mine = bookings.filter(
      (b) => b.owner_id === a.owner_id && zids.includes(b.zimmer_id) && inWindow(b.check_in),
    );
    if (mine.length === 0) return { sent: false };
    const byZimmer = {};
    mine.forEach((b) => {
      (byZimmer[b.zimmer_id] ||= []).push(b);
    });
    const checkoutTime = {};
    for (const zid of Object.keys(byZimmer)) {
      try {
        const z = await store.get('Zimmer', zid, SERVICE_ACTOR);
        checkoutTime[zid] = z?.stay_settings?.checkout_time || '11:00';
      } catch {
        checkoutTime[zid] = '11:00';
      }
    }
    const lines = [];
    Object.entries(byZimmer).forEach(([zid, list]) => {
      lines.push(`📍 ${list[0].zimmer_name || 'צימר'} (יציאה ${checkoutTime[zid] || '11:00'}):`);
      list
        .sort((x, y) => (x.check_out || '').localeCompare(y.check_out || ''))
        .forEach((b) => {
          lines.push(`   • ${b.check_out}${b.num_guests ? ` · ${b.num_guests} אורחים` : ''}`);
        });
    });
    const title = `לו"ז ניקיון ${windowDays > 7 ? 'לתקופה הקרובה' : 'לשבוע הקרוב'} — ${contact.name}`;
    const body = `שלום ${contact.name},\nסיכום הניקיון (${todayStr} עד ${endStr}):\n\n${lines.join('\n')}`;
    try {
      const res = await sendSupplierMessage(
        store,
        {
          contact_id: contact.id,
          contact_name: contact.name,
          contact_phone: contact.phone,
          owner_id: a.owner_id,
          category: 'reminder',
          title,
          body,
        },
        SERVICE_ACTOR,
      );
      return { sent: true, delivery: res?.delivery };
    } catch (e) {
      return { sent: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  const mine = bookings.filter(
    (b) =>
      b.owner_id === a.owner_id &&
      zids.includes(b.zimmer_id) &&
      (inWindow(b.check_in) || inWindow(b.check_out)),
  );
  if (mine.length === 0) return { sent: false };
  const towelsPer = typeof a.towels_per_guest === 'number' ? a.towels_per_guest : 2;
  const linensPer = typeof a.linens_per_guest === 'number' ? a.linens_per_guest : 1;
  let towels = 0;
  let linens = 0;
  const lines = [];
  mine.forEach((b) => {
    const guests = b.num_guests || b.num_adults || 1;
    const events = (inWindow(b.check_in) ? 1 : 0) + (inWindow(b.check_out) ? 1 : 0);
    towels += guests * towelsPer * events;
    linens += guests * linensPer * events;
    const kind =
      inWindow(b.check_in) && inWindow(b.check_out)
        ? 'כניסה + יציאה'
        : inWindow(b.check_in)
          ? 'כניסה'
          : 'יציאה';
    lines.push(`• ${b.zimmer_name || 'צימר'} — ${kind}${b.check_in ? ` ${b.check_in}` : ''} · ${guests} אורחים`);
  });
  const title = `הזמנת מגבות/מצעים ${windowDays > 7 ? 'לתקופה הקרובה' : 'יומית'} — ${contact.name}`;
  const body = `שלום ${contact.name},\nכמויות להכנה (${todayStr} עד ${endStr}):\n\n${lines.join('\n')}\n\nסה"כ להכנה: ${towels} מגבות · ${linens} מצעים.`;
  try {
    const res = await sendSupplierMessage(
      store,
      {
        contact_id: contact.id,
        contact_name: contact.name,
        contact_phone: contact.phone,
        owner_id: a.owner_id,
        category: 'order',
        title,
        body,
      },
      SERVICE_ACTOR,
    );
    return { sent: true, delivery: res?.delivery };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
