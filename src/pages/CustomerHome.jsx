import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Search as SearchIcon } from 'lucide-react';
import CustomerTopBar from '@/components/customer/CustomerTopBar';
import CustomerHamburger from '@/components/customer/CustomerHamburger';
import CustomerChat from '@/pages/CustomerChat';
import ZimmerBrowseTab from '@/components/customer/ZimmerBrowseTab';
import ZimmerPublicPage from '@/components/customer/ZimmerPublicPage';
import PromotionsPopup from '@/components/customer/PromotionsPopup';
import RoleBlockScreen from '@/components/auth/RoleBlockScreen';

// The customer's main home ("/"): a zimmer index with the main search chat
// beside it. The chat is a single persistent instance that repositions between
// a desktop side-column (index view) and a floating button -> overlay (zimmer
// page or mobile), so its conversation state survives navigation.
export default function CustomerHome({ forceCustomer = false }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [block, setBlock] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchDates, setSearchDates] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Lifted state connecting the chat (search engine) to the index (results).
  const [filterIds, setFilterIds] = useState(null); // null = no AI filter yet
  const [aiMode, setAiMode] = useState(true); // true = chat-driven, false = manual filters
  const [promotionsOpen, setPromotionsOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let u = await api.auth.me();
        if (!alive) return;
        // If the user just chose a role on /welcome, lock it now. A locked user
        // trying to switch to the other role gets a block screen instead.
        const pending = sessionStorage.getItem('pending_role_choice');
        if (pending === 'customer') {
          sessionStorage.removeItem('pending_role_choice');
          try {
            const res = await api.functions.invoke('lockUserRole', { role: 'customer' });
            const data = res?.data || res;
            if (data?.blocked) {
              setBlock({ current_role: data.current_role, requested_role: 'customer', user_id: u?.id, email: u?.email });
              return;
            }
            if (data?.role && data.role !== (u?.role)) u = { ...u, role: data.role };
          } catch {}
        }
        if (!alive) return;
        if (!forceCustomer) {
          if (u?.role === 'admin') { window.location.href = '/superadmin'; return; }
          if (u?.role === 'owner') { window.location.href = '/owner'; return; }
        }
        setUser(u || null);
        setChecking(false);
      } catch {
        if (alive) { setUser(null); setChecking(false); }
      }
    })();
    return () => { alive = false; };
  }, []);

  if (block) {
    return <RoleBlockScreen currentRole={block.current_role} requestedRole={block.requested_role} userEmail={block.email} userId={block.user_id} onBack={() => window.location.href = '/welcome'} />;
  }

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#F8F7F4' }}>
        <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const zimmerMode = !!selected;
  const sideChat = !zimmerMode && !isMobile;
  const overlay = !sideChat && chatOpen;

  const handleSelect = (z, dates) => {
    setSearchDates(dates || null);
    setSelected(z);
    setChatOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Chat search → feed the index with smart-filtered results and switch to AI mode.
  const handleSearchResults = (ids, dates) => {
    setFilterIds(Array.isArray(ids) ? ids : null);
    if (dates) setSearchDates(dates);
    setAiMode(true);
    if (selected) setSelected(null);
  };
  // Index "סינון ידני" button → leave AI mode, show full filter panel.
  const handleResetAI = () => { setAiMode(false); setFilterIds(null); };
  // Index "חזרה לחיפוש AI" button → back to AI mode (empty until next chat search).
  const handleBackToAI = () => { setAiMode(true); setFilterIds(null); };
  // Chat "צ'אט חדש" tab → reset both the chat and the index to a clean state.
  const handleResetAll = () => { setAiMode(true); setFilterIds(null); setSelected(null); };

  const wrapperClass = sideChat
    ? 'hidden lg:flex w-[400px] flex-shrink-0 h-full overflow-hidden'
    : overlay
      ? 'fixed inset-0 z-[60]'
      : 'hidden';
  const panelClass = sideChat
    ? 'w-full h-full flex flex-col'
    : overlay
      ? 'absolute inset-0 sm:inset-x-6 sm:top-6 sm:bottom-6 sm:rounded-3xl overflow-hidden flex flex-col'
      : 'hidden';

  return (
    <div dir="rtl" className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: 'Heebo, sans-serif', background: '#F8F7F4' }}>
      <CustomerTopBar
        onOpenMenu={() => setMenuOpen(true)}
        onBack={zimmerMode ? () => setSelected(null) : undefined}
        showPromotions={!zimmerMode}
        onOpenPromotions={() => setPromotionsOpen(true)}
      />
      <CustomerHamburger open={menuOpen} onClose={() => setMenuOpen(false)} user={user} />

      <div className="flex-1 flex min-h-0">
        {/* Main content — scrolls independently */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto">
          {zimmerMode ? (
            <ZimmerPublicPage zimmer={selected} user={user} onBack={() => setSelected(null)} searchDates={searchDates} />
          ) : (
            <div className="p-4 lg:p-6">
              <ZimmerBrowseTab
                user={user}
                onSelect={handleSelect}
                filterIds={filterIds}
                aiMode={aiMode}
                onResetAI={handleResetAI}
                onBackToAI={handleBackToAI}
              />
            </div>
          )}
        </main>

        {/* Persistent main search chat — scrolls independently (its own internal scroll) */}
        <div className={wrapperClass}>
          {overlay && <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setChatOpen(false)} />}
          <div className={panelClass}>
            <CustomerChat variant={sideChat ? 'side' : 'overlay'} onClose={sideChat ? undefined : () => setChatOpen(false)} onSearchResults={handleSearchResults} onResetAll={handleResetAll} />
          </div>
        </div>
      </div>

      {/* Floating chat button when the chat is not shown as a side column (mobile index only) */}
      {!sideChat && !chatOpen && !zimmerMode && (
        <button onClick={() => setChatOpen(true)}
          className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-5 h-12 rounded-full text-white shadow-xl transition-transform hover:scale-105"
          style={{ background: '#0B3838' }}>
          <SearchIcon size={18} /> צ'אט חיפוש
        </button>
      )}

      <PromotionsPopup open={promotionsOpen} onClose={() => setPromotionsOpen(false)} />
    </div>
  );
}