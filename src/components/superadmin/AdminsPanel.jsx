import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Shield, ShieldCheck, Save, X } from 'lucide-react';

const ALL_PAGES = [
  { id: 'owners', label: 'בעלי מתחמים' },
  { id: 'zimmers', label: 'כל הצימרים' },
  { id: 'bookings', label: 'כל ההזמנות' },
  { id: 'customers', label: 'לקוחות' },
  { id: 'add_owner', label: 'הוסף בעל מתחם' },
  { id: 'chat_history', label: 'היסטוריית התכתבויות' },
  { id: 'admins', label: 'ניהול אדמינים' },
];

const inputStyle = {
  background: '#F8F7F4',
  border: '1.5px solid #E8E5E0',
  color: '#1A1A1A',
  outline: 'none',
  borderRadius: '12px',
};

export default function AdminsPanel() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editState, setEditState] = useState({});
  const [deletingAdmin, setDeletingAdmin] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.AdminPermission.list();
    setAdmins(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    setAddMsg('');
    await base44.entities.AdminPermission.create({
      email: newEmail.trim().toLowerCase(),
      is_primary: false,
      is_active: true,
      allowed_pages: ALL_PAGES.map(p => p.id),
    });
    setNewEmail('');
    setAddMsg('✅ אדמין נוסף בהצלחה');
    await load();
    setAdding(false);
    setTimeout(() => setAddMsg(''), 3000);
  };

  const startEdit = (admin) => {
    setEditingId(admin.id);
    setEditState({
      is_primary: admin.is_primary || false,
      is_active: admin.is_active !== false,
      allowed_pages: admin.allowed_pages || ALL_PAGES.map(p => p.id),
    });
  };

  const togglePage = (pageId) => {
    setEditState(prev => {
      const pages = prev.allowed_pages || [];
      return {
        ...prev,
        allowed_pages: pages.includes(pageId)
          ? pages.filter(p => p !== pageId)
          : [...pages, pageId],
      };
    });
  };

  const handleSave = async () => {
    await base44.entities.AdminPermission.update(editingId, editState);
    setEditingId(null);
    await load();
  };

  const handleDelete = async () => {
    await base44.entities.AdminPermission.delete(deletingAdmin.id);
    setDeletingAdmin(null);
    await load();
  };

  return (
    <div>
      {/* Delete confirm */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-7 max-w-sm w-full mx-4 text-center" dir="rtl" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Trash2 size={22} style={{ color: '#EF4444' }} />
            </div>
            <h3 className="text-lg font-black mb-1" style={{ color: '#1A1A1A' }}>מחיקת אדמין</h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>למחוק את <strong>{deletingAdmin.email}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingAdmin(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ border: '1.5px solid #E8E5E0', color: '#6B7280' }}>ביטול</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: '#EF4444' }}>מחק</button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-black mb-8" style={{ color: '#1A1A1A' }}>ניהול אדמינים ({admins.length})</h1>

      {/* Add new */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: '#1A1A1A' }}>
          <Shield size={15} style={{ color: '#F97316' }} /> הוסף אדמין חדש
        </h2>
        <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>כל מייל שיתחבר למערכת ידו — יקבל גישת אדמין-על אוטומטית</p>
        <div className="flex gap-3">
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="כתובת אימייל..."
            className="flex-1 px-4 py-2.5 text-sm"
            style={inputStyle}
          />
          <button onClick={handleAdd} disabled={adding || !newEmail.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: '#F97316' }}>
            <Plus size={15} />{adding ? 'מוסיף...' : 'הוסף'}
          </button>
        </div>
        {addMsg && <p className="text-sm mt-2" style={{ color: '#6B7280' }}>{addMsg}</p>}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>אין אדמינים רשומים עדיין</p>
        </div>
      ) : (
        <div className="space-y-3">
          {admins.map(admin => (
            <div key={admin.id} className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              {/* Header row */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: admin.is_primary ? 'rgba(249,115,22,0.12)' : '#F0EEE8' }}>
                    {admin.is_primary
                      ? <ShieldCheck size={18} style={{ color: '#F97316' }} />
                      : <Shield size={18} style={{ color: '#9CA3AF' }} />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>{admin.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {admin.is_primary && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>
                          אדמין ראשי
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={admin.is_active !== false
                          ? { background: 'rgba(34,197,94,0.1)', color: '#16A34A' }
                          : { background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                        {admin.is_active !== false ? 'פעיל' : 'מושהה'}
                      </span>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        {(admin.allowed_pages || []).length}/{ALL_PAGES.length} דפים
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === admin.id ? (
                    <>
                      <button onClick={handleSave}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                        style={{ background: '#22C55E' }}>
                        <Save size={13} /> שמור
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs"
                        style={{ background: '#F0EEE8', color: '#6B7280' }}>
                        <X size={13} /> ביטול
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(admin)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                        style={{ background: 'rgba(249,115,22,0.08)', color: '#EA580C' }}>
                        עריכה
                      </button>
                      <button onClick={() => setDeletingAdmin(admin)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Edit panel */}
              {editingId === admin.id && (
                <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: '#F0EEE8' }}>
                  {/* Primary + Active toggles */}
                  <div className="flex gap-4 mt-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setEditState(p => ({ ...p, is_primary: !p.is_primary }))}
                        className="w-10 h-5 rounded-full transition-colors flex items-center px-0.5"
                        style={{ background: editState.is_primary ? '#F97316' : '#E8E5E0' }}>
                        <div className="w-4 h-4 bg-white rounded-full shadow transition-transform"
                          style={{ transform: editState.is_primary ? 'translateX(-20px)' : 'translateX(0)' }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>אדמין ראשי</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => setEditState(p => ({ ...p, is_active: !p.is_active }))}
                        className="w-10 h-5 rounded-full transition-colors flex items-center px-0.5"
                        style={{ background: editState.is_active ? '#22C55E' : '#E8E5E0' }}>
                        <div className="w-4 h-4 bg-white rounded-full shadow transition-transform"
                          style={{ transform: editState.is_active ? 'translateX(-20px)' : 'translateX(0)' }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>פעיל</span>
                    </label>
                  </div>

                  {/* Pages checkboxes */}
                  <p className="text-xs font-semibold mb-2" style={{ color: '#6B7280' }}>דפים מורשים:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ALL_PAGES.map(page => {
                      const checked = (editState.allowed_pages || []).includes(page.id);
                      return (
                        <button key={page.id} onClick={() => togglePage(page.id)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all text-right"
                          style={checked
                            ? { background: 'rgba(249,115,22,0.1)', color: '#EA580C', border: '1.5px solid rgba(249,115,22,0.3)' }
                            : { background: '#F8F7F4', color: '#9CA3AF', border: '1.5px solid #E8E5E0' }}>
                          <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: checked ? '#F97316' : '#E8E5E0' }}>
                            {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          {page.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}