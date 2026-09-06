import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/api/client';
import { formatPhoneDisplay } from '@/lib/rooms';
import { calcNights, getBookingTotal, formatILS } from '@/lib/bookingPrice';
import { X, Star, Calendar, Wallet, Users, Home, Sparkles, RefreshCw, StickyNote, Save } from 'lucide-react';

export default function GuestProfileDetail({ guest, ownerId, zimmers, onClose, onUpdated }) {
  const [notes, setNotes] = useState(guest.notes || '');
  const [aiSummary, setAiSummary] = useState(guest.ai_summary || '');
  const [aiUpdated, setAiUpdated] = useState(guest.ai_summary_updated_at);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [zimList, setZimList] = useState(zimmers || []);

  useEffect(() => { setNotes(guest.notes || ''); setAiSummary(guest.ai_summary || ''); setAiUpdated(guest.ai_summary_updated_at); }, [guest.phone_e164]);

  useEffect(() => {
    if (zimmers || zimList.length) return;
    let active = true;
    (async () => {
      try {
        const list = await api.entities.Zimmer.filter({ owner_id: ownerId });
        if (active) setZimList(list);
      } catch (e) { /* ignore */ }
    })();
    return () => { active = false; };
  }, [ownerId]);

  const saveNotes = async () => {
    setSaving(true);
    try {
      let profileId = guest.profile_id;
      if (profileId) {
        await api.entities.GuestProfile.update(profileId, { notes });
      } else {
        const created = await api.entities.GuestProfile.create({
          owner_id: ownerId,
          phone_e164: guest.phone_e164,
          guest_name: guest.guest_name,
          notes,
        });
        profileId = created?.id;
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      onUpdated?.({ ...guest, notes, profile_id: profileId });
    } finally {
      setSaving(false);
    }
  };

  const refreshSummary = async () => {
    setRefreshing(true);
    try {
      const res = await api.functions.invoke('buildGuestSummary', {
        owner_id: ownerId,
        guest_phone: guest.last?.guest_phone || guest.phone_e164,
      });
      const data = res?.data || res;
      if (data?.ai_summary) {
        setAiSummary(data.ai_summary);
        setAiUpdated(new Date().toISOString());
        if (!guest.profile_id && data.profile_id) {
          onUpdated?.({ ...guest, profile_id: data.profile_id, ai_summary: data.ai_summary, ai_summary_updated_at: new Date().toISOString() });
        } else {
          onUpdated?.({ ...guest, ai_summary: data.ai_summary, ai_summary_updated_at: new Date().toISOString() });
        }
      }
    } catch (e) { /* ignore */ }
    finally { setRefreshing(false); }
  };

  const stops = (guest.stays || []).slice().sort((a, b) => new Date(b.check_out) - new Date(a.check_out));

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex"
        dir="rtl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: 'rgba(17,17,17,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="h-full w-full max-w-xl mr-auto overflow-y-auto"
          style={{ background: '#fff', borderLeft: '1.5px solid #F0EEE8', boxShadow: '-20px 0 60px rgba(0,0,0,0.12)' }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 px-5 py-4 flex items-start justify-between gap-3" style={{ background: '#fff', borderBottom: '1px solid #F0EEE8' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white text-lg" style={{ background: 'linear-gradient(135deg, #F97316, #FB923C)' }}>
                {(guest.guest_name || '?').trim().charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black truncate" style={{ color: '#1A1A1A' }}>{guest.guest_name}</h2>
                <p className="text-xs" style={{ color: '#9CA3AF' }} dir="ltr">{formatPhoneDisplay(guest.phone_e164)}</p>
                <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                  {guest.stays_count}× התארח אצלך · סה״כ {formatILS(guest.total_paid)}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F8F7F4', color: '#6B7280' }}>
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Stays history */}
            <section>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                <Calendar size={15} style={{ color: '#F97316' }} /> היסטוריית שהייה
              </h3>
              <div className="space-y-2.5">
                {stops.map((b, i) => {
                  const nights = calcNights(b.check_in, b.check_out);
                  const amount = getBookingTotal(b, zimList.find((z) => z.id === b.zimmer_id));
                  return (
                    <div key={b.id || i} className="rounded-xl p-3.5" style={{ background: '#F8F7F4', border: '1px solid #F0EEE8' }}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 text-sm font-semibold min-w-0" style={{ color: '#1A1A1A' }}>
                          <Home size={13} style={{ color: '#9CA3AF' }} />
                          <span className="truncate">{b.zimmer_name || '—'}</span>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: '#16A34A' }}>{formatILS(amount)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: '#6B7280' }}>
                        <span>{gDate(b.check_in)} → {gDate(b.check_out)}</span>
                        {nights > 0 && <span>· {nights} לילות</span>}
                        {b.num_guests && <span className="inline-flex items-center gap-1"><Users size={11} /> {b.num_guests} אורחים</span>}
                        {b.checkout_rating && (
                          <span className="inline-flex items-center gap-1" style={{ color: '#F59E0B' }}>
                            <Star size={11} fill="currentColor" /> {b.checkout_rating}
                          </span>
                        )}
                      </div>
                      {b.notes && <p className="text-xs mt-2 pt-2" style={{ color: '#6B7280', borderTop: '1px dashed #E8E5E0' }}>הערות: {b.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* AI summary */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                  <Sparkles size={15} style={{ color: '#6366F1' }} /> סיכום AI ללקוח
                </h3>
                <button
                  onClick={refreshSummary}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-50"
                  style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> רענן
                </button>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                {aiSummary ? (
                  <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#374151' }}>{aiSummary}</p>
                ) : (
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>
                    {refreshing ? 'בונה סיכום מתוך שיחות והיסטוריית שהייה...' : 'אין סיכום עדיין. לחץ "רענן" כדי לבנות סיכום AI מתוך כל שיחות האורח.'}
                  </p>
                )}
                {aiUpdated && (
                  <p className="text-[11px] mt-3 pt-2" style={{ color: '#9CA3AF', borderTop: '1px dashed rgba(99,102,241,0.2)' }}>
                    עודכן: {new Date(aiUpdated).toLocaleString('he-IL')}
                  </p>
                )}
              </div>
            </section>

            {/* Owner notes */}
            <section>
              <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                <StickyNote size={15} style={{ color: '#F97316' }} /> הערות פנימיות
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="הערות אישיות על הלקוח — רק אתה רואה אותן..."
                className="w-full px-3.5 py-3 text-sm rounded-xl outline-none transition-all resize-none"
                style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8', color: '#1A1A1A' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#F0EEE8'; e.currentTarget.style.background = '#F8F7F4'; }}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={saveNotes}
                  disabled={saving || notes === (guest.notes || '')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg disabled:opacity-50 transition-all"
                  style={{ background: '#F97316', color: '#fff' }}
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  {savedFlash ? 'נשמר ✓' : 'שמור הערות'}
                </button>
              </div>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function gDate(s) { return s ? new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''; }