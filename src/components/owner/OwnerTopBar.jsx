import React from 'react';
import logoTravvin from '@/assets/owner/home/logo-travvin.svg';
import btnHamburger from '@/assets/owner/home/btn-hamburger.svg';
import iconAddPlus from '@/assets/owner/home/icon-add-booking-plus.svg';
import iconBell from '@/assets/owner/home/icon-bell-figma.svg';
import underlineWavy from '@/assets/owner/home/underline-wavy.svg';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';

/** Figma Frame 86 top bar — background 1011:975 = #FAFAFA */
export default function OwnerTopBar({ tab, primaryNav, onNav, onAddBooking, onBell, onSpark, onHamburger }) {
  return (
    <header
      dir="rtl"
      className="sticky top-0 z-30 flex-shrink-0"
      style={{ backgroundColor: '#FAFAFA', background: '#FAFAFA' }}
    >
      <div
        className="flex items-center justify-between px-4 lg:px-6"
        style={{ height: 72 }}
      >
        <div className="flex items-center min-w-0" style={{ gap: 24 }}>
          <div className="overflow-hidden flex-shrink-0" style={{ width: 129, height: 29, maxWidth: '28vw' }}>
            <img src={logoTravvin} alt="Travvin" width={129} height={29} className="block w-full h-full object-contain object-right" />
          </div>

          <nav className="hidden lg:flex items-center" style={{ gap: 57 }}>
            {primaryNav.map(({ id, shortLabel }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onNav(id)}
                  className="font-simona relative whitespace-nowrap transition-all"
                  style={{
                    color: '#0B3838',
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: 'normal',
                    textAlign: 'right',
                    textDecoration: active ? 'underline' : 'none',
                    textUnderlineOffset: 4,
                    textDecorationThickness: 1.5,
                  }}
                >
                  {shortLabel}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: 16 }}>
          {/* Figma 1011:1003 — SimplerPro Extended Semibold 16 + wave */}
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
            className="relative flex items-center justify-center transition-all hover:opacity-80"
            style={{ width: 18, height: 20 }}
          >
            <img src={iconBell} alt="" width={18} height={20} className="block w-full h-full" />
          </button>

          <button
            type="button"
            onClick={onSpark}
            title="עוזר AI"
            className="flex-shrink-0 transition-all hover:opacity-90 rounded-full"
          >
            <OwnerAiIcon size={36} />
          </button>

          <button
            type="button"
            onClick={onHamburger}
            title="תפריט"
            className="overflow-hidden flex-shrink-0 transition-all hover:opacity-90 rounded-full"
            style={{ width: 36, height: 36 }}
          >
            <img src={btnHamburger} alt="" width={36} height={36} className="block w-full h-full" />
          </button>
        </div>
      </div>
    </header>
  );
}
