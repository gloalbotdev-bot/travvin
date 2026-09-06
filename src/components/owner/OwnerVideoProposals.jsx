import React, { useState, useRef } from 'react';
import { api } from '@/api/client';
import { Check, X, Play, Pause } from 'lucide-react';

// Pending video proposals sent by admins to this owner. Shown at the top of
// the owner's video tab. Each card has a gradient overlay with "נשלח ממערכת
// TRAVVIN" at the top, the proposed caption + admin note clearly shown, and
// three actions: צפה (play in-card with sound), אישור סרטון (go live), דחה.
// Uses respondVideoProposal (server enforces ownership + pending status).
export default function OwnerVideoProposals({ videos, onResolved }) {
  const pending = videos.filter((v) => v.proposal_status === 'הצעה');
  const [busyId, setBusyId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const videoRefs = useRef({});

  const decide = async (v, decision) => {
    setBusyId(v.id);
    try {
      await api.functions.invoke('respondVideoProposal', { video_id: v.id, decision });
      onResolved(v.id, decision);
    } catch (e) { /* ignore — list refresh will correct */ }
    setBusyId(null);
  };

  const togglePlay = (v) => {
    const el = videoRefs.current[v.id];
    if (!el) return;
    if (playingId === v.id) {
      el.pause();
      setPlayingId(null);
    } else {
      // pause any other playing card
      Object.values(videoRefs.current).forEach((e) => { if (e && e !== el) { try { e.pause(); } catch {} } });
      el.muted = false;
      el.controls = true;
      el.loop = false;
      el.play().catch(() => {});
      setPlayingId(v.id);
    }
  };

  const handleEnded = (v) => {
    // revert to the muted-loop preview state
    const el = videoRefs.current[v.id];
    if (el) { el.controls = false; el.muted = true; el.loop = true; el.load(); }
    setPlayingId(null);
  };

  if (pending.length === 0) return null;

  return (
    <div dir="rtl" style={{ fontFamily: 'Heebo, sans-serif' }} className="mb-6">
      <h2 className="text-base font-black mb-1" style={{ color: '#1A1A1A' }}>הצעות סרטונים ממתינות ({pending.length})</h2>
      <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>סרטונים שהוצעו ע"י האדמין. צפה, אשר כדי שיופיעו בפיד, או דחה.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pending.map((v) => {
          const isPlaying = playingId === v.id;
          return (
            <div key={v.id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #FED7AA' }}>
              <div className="relative aspect-[9/16] bg-black">
                <video
                  ref={(el) => { videoRefs.current[v.id] = el; }}
                  src={v.video_url}
                  className="w-full h-full object-cover"
                  muted loop playsInline
                  onEnded={() => handleEnded(v)}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(11,56,56,0.85) 0%, rgba(11,56,56,0.25) 30%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
                {/* Top label inside gradient */}
                {!isPlaying && (
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between">
                    <span className="text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                      ✦ נשלח ממערכת TRAVVIN
                    </span>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(249,115,22,0.9)', color: '#fff' }}>הצעה</span>
                  </div>
                )}
                {/* Center play hint when not playing */}
                {!isPlaying && (
                  <button onClick={() => togglePlay(v)} className="absolute inset-0 flex items-center justify-center">
                    <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                      <Play size={24} className="text-white" fill="white" />
                    </span>
                  </button>
                )}
                {/* Stop button when playing */}
                {isPlaying && (
                  <button onClick={() => togglePlay(v)} className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                    <Pause size={16} />
                  </button>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs font-semibold mb-2" style={{ color: '#6B7280' }}>{v.zimmer_name}</p>
                {v.proposed_by_name && <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>הוצע ע"י: {v.proposed_by_name}</p>}
                <div className="mb-3">
                  <p className="text-[11px] font-bold mb-1" style={{ color: '#0B3838' }}>התיאור המוצע</p>
                  <p className="text-sm mb-2" style={{ color: v.caption ? '#1A1A1A' : '#9CA3AF' }}>{v.caption || '—'}</p>
                  {v.proposal_note && (
                    <>
                      <p className="text-[11px] font-bold mb-1" style={{ color: '#0B3838' }}>הערה מהאדמין</p>
                      <p className="text-xs rounded-lg px-2.5 py-2" style={{ background: '#F8F7F4', color: '#374151', border: '1px solid #F0EEE8' }}>{v.proposal_note}</p>
                    </>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => decide(v, 'approve')} disabled={busyId === v.id}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-white transition-all disabled:opacity-60" style={{ background: '#16A34A' }}>
                    <Check size={14} /> אישור סרטון
                  </button>
                  <button onClick={() => decide(v, 'reject')} disabled={busyId === v.id}
                    className="px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                    <X size={14} /> דחה
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}