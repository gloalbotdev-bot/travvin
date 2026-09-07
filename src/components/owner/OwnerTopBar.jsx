import React from 'react';
import logoTravvin from '@/assets/owner/home/logo-travvin.svg';
import btnHamburger from '@/assets/owner/home/btn-hamburger.svg';
import iconAddPlus from '@/assets/owner/home/icon-add-booking-plus.svg';
import iconBell from '@/assets/owner/home/icon-bell-figma.svg';
import underlineWavy from '@/assets/owner/home/underline-wavy.svg';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';

export default function OwnerTopBar({ tab, primaryNav, onNav, onAddBooking, notifCount, onBell, onSpark, onHamburger }) {
  return (
    <header dir="rtl" className="sticky top-0 z-30" style={{ background: '#FAFAFA', borderBottom: '1px solid #F0EEE8' }}>
      <div className="flex items-center justify-between px-4 lg:px-6 h-20">
        <div className="flex items-center gap-6 min-w-0">
          <div className="overflow-hidden flex-shrink-0" style={{ width: 129, height: 29, maxWidth: '28vw' }}>
            <img src={logoTravvin} alt="Travvin" width={129} height={29} className="block w-full h-full object-contain object-right" />
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            {primaryNav.map(({ id, shortLabel }) => (
              <button
                key={id}
                type="button"
                onClick={() => onNav(id)}
                className="font-simona relative whitespace-nowrap py-1 transition-all"
                style={{
                  color: '#0B3838',
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: 'normal',
                  textAlign: 'right',
                }}
              >
                {shortLabel}
                {id === 'updates' && notifCount > 0 && (
                  <span
                    className="absolute -top-2 -left-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#EF4444', color: '#fff' }}
                  >
                    {notifCount}
                  </span>
                )}
                {tab === id && (
                  <span
                    className="absolute -bottom-1 right-0 left-0 mx-auto block"
                    style={{ width: '100%', height: 2.5, borderRadius: 2, background: '#0B3838' }}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Figma 1011:75 — SimplerPro Extended Semibold 16 + wave 1011:206 (≈3px tall) */}
          <button
            type="button"
            onClick={onAddBooking}
            dir="ltr"
            className="font-simpler hidden sm:inline-flex flex-col w-max transition-all hover:opacity-80"
            style={{ color: '#0B3838', fontSize: 16, fontWeight: 600, lineHeight: 'normal', fontSynthesis: 'none' }}
          >
            <span className="inline-flex items-center whitespace-nowrap" style={{ gap: 13 }}>
              <span className="shrink-0 overflow-visible" style={{ width: 14, height: 14 }}>
                <img src={iconAddPlus} alt="" width={14} height={14} className="block w-full h-full" />
              </span>
              <span style={{ fontWeight: 600 }}>הוספת הזמנה</span>
            </span>
            <img
              src={underlineWavy}
              alt=""
              aria-hidden
              width={142}
              height={3}
              className="block"
              style={{ width: 142, height: 3, marginTop: 2 }}
            />
          </button>

          <button
            type="button"
            onClick={onBell}
            title="הודעות ועדכונים"
            className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-80"
          >
            <span className="overflow-hidden" style={{ width: 18, height: 20 }}>
              <img src={iconBell} alt="" width={18} height={20} className="block w-full h-full" />
            </span>
            {notifCount > 0 && (
              <span
                className="absolute -top-0.5 -left-0.5 text-[10px] font-bold rounded-full flex items-center justify-center"
                style={{ background: '#EF4444', color: '#fff', minWidth: 16, height: 16, padding: '0 3px' }}
              >
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onSpark}
            title="עוזר AI"
            className="flex-shrink-0 transition-all hover:opacity-90 rounded-full"
          >
            <OwnerAiIcon size={40} />
          </button>

          <button
            type="button"
            onClick={onHamburger}
            title="תפריט"
            className="overflow-hidden flex-shrink-0 transition-all hover:opacity-90 rounded-full"
            style={{ width: 40, height: 40 }}
          >
            <img src={btnHamburger} alt="" width={40} height={40} className="block w-full h-full" />
          </button>
        </div>
      </div>
    </header>
  );
}
