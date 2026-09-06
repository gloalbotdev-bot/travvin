import React, { useEffect } from 'react';
import VideoFeed from '@/components/discover/VideoFeed';
import CustomerBottomNav from '@/components/customer/CustomerBottomNav';

// Public full-screen discover feed (TikTok-style). Accessible to everyone,
// including not-logged-in visitors.
export default function Discover() {
  useEffect(() => { document.title = 'גלו · ZimmerBot'; }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0a0a0a' }} dir="rtl">
      <div className="relative overflow-hidden shadow-2xl"
        style={{ width: 'min(430px, 100vw)', height: 'min(92vh, 760px)', borderRadius: 24, background: '#000' }}>
        <VideoFeed />
        <CustomerBottomNav variant="absolute" />
      </div>
    </div>
  );
}