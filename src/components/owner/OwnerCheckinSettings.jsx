import React, { useState } from 'react';
import SupplierAutomationPanel from '@/components/owner/SupplierAutomationPanel';
import OwnerCustomerMessages from '@/components/owner/OwnerCustomerMessages';
import OwnerAutomationHistory from '@/components/owner/OwnerAutomationHistory';
import { History, Users, Truck } from 'lucide-react';

// Automatic messages hub. Default tab: history of sent messages (customers + suppliers).
// Two additional tabs to configure customer and supplier automations.
export default function OwnerCheckinSettings({ ownerId }) {
  const [section, setSection] = useState('history');

  const tabs = [
    { v: 'history', l: 'היסטוריית הודעות', icon: History },
    { v: 'customers', l: 'הודעות ללקוחות', icon: Users },
    { v: 'suppliers', l: 'הודעות לספקים', icon: Truck },
  ];

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: '#1A1A1A' }}>הודעות אוטומטיות</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>צפייה בהודעות שנשלחו והגדרת הודעות אוטומטיות ללקוחות ולספקים.</p>
      </div>

      <div className="mb-5 flex gap-2 flex-wrap">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.v} onClick={() => setSection(t.v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={section === t.v ? { background: '#F97316', color: '#fff' } : { background: '#fff', border: '1.5px solid #E8E5E0', color: '#6B7280' }}>
              <Icon size={15} /> {t.l}
            </button>
          );
        })}
      </div>

      {section === 'history' && <OwnerAutomationHistory ownerId={ownerId} />}
      {section === 'suppliers' && <SupplierAutomationPanel ownerId={ownerId} />}
      {section === 'customers' && <OwnerCustomerMessages ownerId={ownerId} />}
    </div>
  );
}