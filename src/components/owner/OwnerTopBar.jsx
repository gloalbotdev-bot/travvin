import React from 'react';
import logoTravvin from '@/assets/owner/home/logo-travvin.svg';
import btnHamburger from '@/assets/owner/home/btn-hamburger.svg';
import iconAddPlus from '@/assets/owner/home/icon-add-booking-plus.svg';
import iconBell from '@/assets/owner/home/icon-bell-figma.svg';
import OwnerAiIcon from '@/components/owner/OwnerAiIcon';

/** Figma 1776:20400 — owner top navbar (1920×81). Items are top-aligned with per-item offsets from Figma. */
export default function OwnerTopBar({ tab, primaryNav, onNav, onAddBooking, onBell, onSpark, onHamburger }) {
  return (
    <header
      dir="rtl"
      className="sticky top-0 z-40 flex-shrink-0"
      /* Figma 1776:19644 — shadow under the bar; Today / Bookings / AI (1776:18312, 1776:20362, 1776:18070) have none.
         Frame 108 (AI): bar fill is hidden, so it shows the page #FCFCFC. */
      style={{
        background: tab === 'assistant' ? '#FCFCFC' : '#FFFFFF',
        boxShadow: ['home', 'bookings', 'assistant'].includes(tab) ? 'none' : '0px 4px 21.1px rgba(0,0,0,0.07)',
      }}
    >
      <div
        className="relative flex items-start justify-between pr-4 pl-4 lg:pr-[58px] lg:pl-[45px]"
        style={{ height: 81 }}
      >
        {/* Figma 1776:20411 — logo, top 31.61 */}
        <div className="overflow-hidden flex-shrink-0" style={{ width: 129, height: 29, maxWidth: '28vw', marginTop: 31.6 }}>
          <img src={logoTravvin} alt="Travvin" width={129} height={29} className="block w-full h-full object-contain object-right" />
        </div>

        {/* Figma 1776:20403 — glass tab pill */}
        <nav
          aria-label="ניווט ראשי"
          className="hidden lg:flex items-center absolute left-1/2 -translate-x-1/2"
          style={{
            top: 14.27,
            height: 48,
            gap: 'clamp(20px, 2.71vw, 52px)',
            padding: '9px clamp(20px, 1.77vw, 34px)',
            borderRadius: 34,
            background: 'rgba(255,255,255,0.35)',
            border: '0.5px solid rgba(86,86,86,0.23)',
            boxShadow: '0px 4px 10.2px 0px rgba(0,0,0,0.09)',
          }}
        >
          {primaryNav.map(({ id, shortLabel }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNav(id)}
                aria-current={active ? 'page' : undefined}
                className={`relative font-simona whitespace-nowrap transition-colors flex items-center ${active ? '' : 'hover:opacity-80'}`}
                style={{
                  color: '#0B3838',
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: 'normal',
                  ...(active
                    ? { background: '#F5F5F5', height: 32, padding: '9px clamp(20px, 1.77vw, 34px) 13px', borderRadius: 34 }
                    : null),
                }}
              >
                {shortLabel}
                {active && (
                  /* Figma 1776:18459 — active tab underline 42.4×2.17 */
                  <span
                    aria-hidden="true"
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ bottom: 1.1, width: 42.4, height: 2.17, background: '#0B3838', borderRadius: '20px 20px 0 0' }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-start flex-shrink-0">
          {/* Figma 1776:20437 — PrimaryLink, top 19.45 */}
          <button
            type="button"
            onClick={onAddBooking}
            className="font-simpler hidden sm:inline-flex lg:hidden xl:inline-flex items-center justify-center whitespace-nowrap transition-all hover:bg-[#0B3838]/5"
            style={{
              width: 175,
              height: 42,
              gap: 12,
              padding: 12,
              borderRadius: 35,
              border: '1px solid rgba(11,56,56,0.21)',
              color: '#0B3838',
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 'normal',
              marginLeft: 29,
              /* Figma 19.45 — snapped to a whole pixel; a fractional top blurs the text on Windows. */
              marginTop: 19,
            }}
          >
            <span>הוספת הזמנה</span>
            <img src={iconAddPlus} alt="" width={14} height={14} className="block shrink-0" style={{ width: 14, height: 14 }} />
          </button>

          {/* Figma 1776:20436 — bell, top 29.5 (incl. stroke bleed) */}
          <button
            type="button"
            onClick={onBell}
            title="הודעות ועדכונים"
            aria-label="הודעות ועדכונים"
            className="relative flex items-center justify-center transition-all hover:opacity-80"
            style={{ width: 18, height: 20, marginLeft: 34, marginTop: 28.5 }}
          >
            <img src={iconBell} alt="" width={18} height={20} className="block w-full h-full" />
          </button>

          {/* Figma 1776:20427 — AI button, top 17.35 */}
          <button
            type="button"
            onClick={onSpark}
            title="עוזר AI"
            aria-label="עוזר AI"
            className="flex-shrink-0 transition-all hover:opacity-90 rounded-full"
            style={{ marginLeft: 12.7, marginTop: 17.35 }}
          >
            <OwnerAiIcon size={40} />
          </button>

          {/* Figma 1776:20421 — hamburger, top 16.86 */}
          <button
            type="button"
            onClick={onHamburger}
            title="תפריט"
            aria-label="תפריט"
            className="overflow-hidden flex-shrink-0 transition-all hover:opacity-90 rounded-full"
            style={{ width: 40, height: 41, marginTop: 16.86 }}
          >
            <img src={btnHamburger} alt="" width={40} height={41} className="block w-full h-full" />
          </button>
        </div>
      </div>
    </header>
  );
}
