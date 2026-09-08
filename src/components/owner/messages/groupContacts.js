// Grouping helpers: collapse many per-zimmer threads / questions into one contact.

const normName = (n) => (n || '').trim().toLowerCase();
const normPhone = (p) => (p || '').replace(/\D/g, '');

export function buildContactKey(name, phone) {
  const n = normName(name);
  const p = normPhone(phone);
  return p ? `${n}__${p}` : `name:${n}`;
}

// Build lookup maps from GuestProfile records: customer_id -> phone, guest_name -> phone.
export function buildPhoneLookup(profiles) {
  const byUserId = new Map();
  const byName = new Map();
  const profileByKey = new Map();
  for (const p of profiles || []) {
    if (!p.phone_e164) continue;
    for (const uid of p.guest_user_ids || []) byUserId.set(uid, p.phone_e164);
    if (p.guest_name) byName.set(normName(p.guest_name), p.phone_e164);
    const k = buildContactKey(p.guest_name, p.phone_e164);
    if (k) profileByKey.set(k, p);
  }
  return { byUserId, byName, profileByKey };
}

export function groupChatsByContact(threads, lookup) {
  const map = new Map();
  for (const t of threads || []) {
    const phone = lookup.byUserId.get(t.customer_id) || lookup.byName.get(normName(t.customer_name)) || '';
    const key = buildContactKey(t.customer_name, phone);
    if (!map.has(key)) {
      const profile = lookup.profileByKey.get(key);
      map.set(key, { key, name: t.customer_name || 'לקוח', phone, staysCount: profile?.stays_count || 0, threads: [] });
    }
    map.get(key).threads.push(t);
  }
  return [...map.values()];
}

export function groupQuestionsByContact(questions, lookup) {
  const map = new Map();
  for (const q of questions || []) {
    const phone =
      lookup.byUserId.get(q.created_by_id) ||
      lookup.byName.get(normName(q.customer_name)) ||
      '';
    // Prefer stable id when name/phone missing so anonymous questions still appear.
    const key = phone || normName(q.customer_name)
      ? buildContactKey(q.customer_name, phone)
      : `qid:${q.created_by_id || q.id}`;
    if (!map.has(key)) {
      const profile = lookup.profileByKey.get(key);
      map.set(key, {
        key,
        name: q.customer_name || 'לקוח',
        phone,
        staysCount: profile?.stays_count || 0,
        questions: [],
      });
    }
    map.get(key).questions.push(q);
  }
  return [...map.values()];
}

// Parse "HH:MM" (or "HH:MM:SS") into {h, min}; null if unparseable.
export function parseMsgTime(t) {
  if (!t || typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return { h: +m[1], min: +m[2] };
}