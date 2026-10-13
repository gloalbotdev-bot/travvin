import { useState, useEffect } from 'react';
import { api } from '@/api/client';

/** Today's bookings / questions / chats and the derived "לטיפול" actions (shared by Today + dashboard sidebar). */
export default function useOwnerTodayData({ ownerId, zimmers, onAction, onNavigate, onEditZimmer }) {
  const [bookings, setBookings] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedZimmer, setSelectedZimmer] = useState('all');

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [b, q, c] = await Promise.all([
          api.entities.BookingRequest.filter({ owner_id: ownerId }),
          api.entities.UnansweredQuestion.filter({ owner_id: ownerId, status: 'ממתינה' }),
          api.entities.DirectChat.filter({ owner_id: ownerId }, '-updated_date'),
        ]);
        if (cancelled) return;
        setBookings(b || []);
        setQuestions(q || []);
        setChats(c || []);
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    };
    load();
    const u1 = api.entities.BookingRequest.subscribe(() => { load(); });
    const u2 = api.entities.UnansweredQuestion.subscribe(() => { load(); });
    const u3 = api.entities.DirectChat.subscribe(() => { load(); });
    return () => {
      cancelled = true;
      u1();
      u2();
      u3();
    };
  }, [ownerId]);

  const today = new Date().toISOString().slice(0, 10);
  const filterZ = (list) => selectedZimmer === 'all' ? list : list.filter(x => x.zimmer_id === selectedZimmer);

  const fb = filterZ(bookings);
  const fq = filterZ(questions);
  const checkoutsToday = fb.filter(b => b.check_out === today && b.status === 'אושרה');
  const checkinsToday = fb.filter(b => b.check_in === today && b.status === 'אושרה');
  const pending = fb.filter(b => b.status === 'ממתינה');
  const activeGuests = fb.filter(b => b.status === 'אושרה' && b.check_in <= today && b.check_out > today);

  const pendingApprovals = fb.filter(b => b.status === 'ממתינה' && !b.cancel_request_reason);
  const cancelRequests = fb.filter(b => b.cancel_request_reason);
  const chatAwaitReply = filterZ(chats).filter(t => (t.messages || []).length > 0 && (t.messages || []).slice(-1)[0]?.role === 'customer');
  const missingInfo = zimmers.filter(z => !z.info_summary && (!z.data_zones || z.data_zones.length === 0));

  const zimmerOf = (id) => zimmers.find(z => z.id === id);

  const actions = [
    ...pendingApprovals.map(b => ({
      id: b.id,
      type: 'approve_booking',
      title: 'הזמנה ממתינה לאישור',
      sub: `${b.guest_name || 'אורחים'} · ${b.zimmer_name || ''} · ${b.check_in} → ${b.check_out}`,
      booking: b,
      zimmer: zimmerOf(b.zimmer_id),
    })),
    ...missingInfo.slice(0, 3).map(z => ({
      id: z.id,
      type: 'missing_info',
      title: 'חסר מידע בנכס',
      sub: `בצימר "${z.name}" חסר מידע על חניה, צ׳ק־אין והתאמה לשבת. המידע הזה יכול לעזור למערכת להתאים את הנכס ללקוחות.`,
      zimmer: z,
    })),
    ...cancelRequests.map(b => ({
      id: b.id,
      type: 'cancel_booking',
      title: 'בקשת ביטול',
      sub: `${b.guest_name} · ${b.zimmer_name} · ${b.cancel_request_reason || ''}`,
      booking: b,
      zimmer: zimmerOf(b.zimmer_id),
    })),
    ...fq.map(q => ({
      id: q.id,
      type: 'answer_question',
      title: `${q.customer_name ? q.customer_name + ' שאלה: ' : ''}${q.question ? `"${q.question}"` : ''}`,
      sub: q.suggested_answer
        ? `הצעה לתשובה: "${q.suggested_answer}"`
        : `בנוגע ל-${q.zimmer_name || 'נכס'}`,
      zimmer: zimmerOf(q.zimmer_id),
    })),
    ...chatAwaitReply.map(t => ({
      id: t.id,
      type: 'open_chat',
      title: `צ'אט מלקוח: ${t.customer_name || 'לקוח'}`,
      sub: `${t.zimmer_name} · ${(t.messages || []).slice(-1)[0]?.content || ''}`,
      zimmer: zimmerOf(t.zimmer_id),
    })),
    ...checkinsToday.slice(0, 3).map(b => ({
      id: b.id,
      type: 'send_directions',
      title: 'אורחים נכנסים היום',
      sub: `${b.guest_name || 'אורחים'} נכנסים היום לצימר "${b.zimmer_name || ''}"${b.check_in_time ? ` בשעה ${b.check_in_time}` : ''}. כדאי לוודא שהניקיון והוראות ההגעה מוכנים.`,
      booking: b,
      zimmer: zimmerOf(b.zimmer_id),
    })),
  ];

  const handleAction = (a) => {
    if (a.type === 'missing_info') onEditZimmer?.(a.zimmer);
    else if (a.type === 'send_directions') onNavigate?.('checkin');
    else onAction?.(a.type, a.id);
  };

  return {
    bookings, loading, selectedZimmer, setSelectedZimmer,
    checkoutsToday, checkinsToday, pending, activeGuests,
    actions, handleAction,
  };
}
