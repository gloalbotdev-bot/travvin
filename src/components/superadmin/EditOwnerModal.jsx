import React, { useState } from 'react';
import { api } from '@/api/client';
import { X } from 'lucide-react';

const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', outline: 'none', borderRadius: '12px' };

export default function EditOwnerModal({ owner, onClose, onSaved }) {
  const isAdminUser = owner.role === 'admin';
  const [form, setForm] = useState({
    full_name: owner.full_name || '',
    role: isAdminUser ? 'owner' : (owner.role || 'owner'),
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // M15 #19 — never send role:admin; do not demote existing admins via this modal
    const patch = { full_name: form.full_name };
    if (!isAdminUser && (form.role === 'owner' || form.role === 'user')) {
      patch.role = form.role;
    }
    await api.entities.User.update(owner.id, patch);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="rounded-2xl p-6 max-w-sm w-full mx-4" dir="rtl" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-lg" style={{ color: '#1A1A1A' }}>עריכת בעל מתחם</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>שם מלא</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-4 py-2.5 text-sm" style={inputStyle} placeholder="שם מלא" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>תפקיד</label>
            {isAdminUser ? (
              <p className="text-sm px-4 py-2.5 rounded-xl" style={{ background: '#F8F7F4', color: '#1A1A1A' }}>
                מנהל-על (לא ניתן לשינוי מכאן)
              </p>
            ) : (
              <>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-4 py-2.5 text-sm" style={inputStyle}>
                  <option value="owner">בעל מתחם</option>
                  <option value="user">לקוח</option>
                </select>
                <p className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>
                  הקצאת מנהל-על נעשית רק דרך הרשאות מנהלים, לא מכאן.
                </p>
              </>
            )}
          </div>
          <p className="text-xs" style={{ color: '#9CA3AF' }}>אימייל: {owner.email}</p>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>ביטול</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            style={{ background: '#F97316' }}>
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  );
}
