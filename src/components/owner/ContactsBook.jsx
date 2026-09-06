import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { Plus, Phone, Mail, Trash2, Users, Wrench } from 'lucide-react';
import OwnerGuests from './OwnerGuests';

const EMPTY_FORM = { name: '', phone: '', email: '', type: 'ספק', category: '', notes: '' };

export default function ContactsBook({ ownerId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ספק');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ownerId) load();
  }, [ownerId]);

  const load = async () => {
    setLoading(true);
    const data = await api.entities.Contact.filter({ owner_id: ownerId });
    setContacts(data);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await api.entities.Contact.create({ ...form, owner_id: ownerId });
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק איש קשר?')) return;
    await api.entities.Contact.delete(id);
    load();
  };

  const filtered = filter === 'הכל' ? contacts : contacts.filter(c => c.type === filter);
  const supplierCount = contacts.filter(c => c.type === 'ספק').length;
  const customerCount = contacts.filter(c => c.type === 'לקוח').length;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black" style={{ color: '#1A1A1A' }}>אנשי קשר</h1>
          <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
            {filter === 'לקוח' ? 'אורחים שסיימו צ׳ק-אאוט אצלך — פרופיל, היסטוריה וסיכום AI' : `${supplierCount} ספקים · ${customerCount} אנשי קשר`}
          </p>
        </div>
        {filter !== 'לקוח' && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
            style={{ background: '#F97316' }}
          >
            <Plus size={16} /> הוסף ספק
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['הכל', 'ספק', 'לקוח'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={filter === f
              ? { background: '#F97316', color: '#fff' }
              : { background: '#fff', color: '#6B7280', border: '1.5px solid #F0EEE8' }}
          >
            {f === 'ספק' ? <><Wrench size={12} className="inline ml-1" />ספקים ({supplierCount})</> :
             f === 'לקוח' ? <><Users size={12} className="inline ml-1" />לקוחות</> : 'הכל'}
          </button>
        ))}
      </div>

      {/* Add form (suppliers) */}
      {showForm && filter !== 'לקוח' && (
        <form onSubmit={handleSave} className="rounded-2xl p-5 mb-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <h3 className="font-bold mb-4" style={{ color: '#1A1A1A' }}>הוספת ספק</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="שם *"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8', color: '#1A1A1A' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#F0EEE8'; e.currentTarget.style.background = '#F8F7F4'; }}
              />
            </div>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="טלפון"
              className="rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8', color: '#1A1A1A' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#F0EEE8'; e.currentTarget.style.background = '#F8F7F4'; }}
            />
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="אימייל"
              className="rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8', color: '#1A1A1A' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#F0EEE8'; e.currentTarget.style.background = '#F8F7F4'; }}
            />
            <div className="col-span-2">
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8', color: '#1A1A1A' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#F0EEE8'; e.currentTarget.style.background = '#F8F7F4'; }}
              >
                <option value="">קטגוריה...</option>
                {['מנקה', 'מכבסה', 'מפעיל צימר', 'גנן', 'טכנאי'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="הערות"
                rows={2}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all resize-none"
                style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8', color: '#1A1A1A' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#F0EEE8'; e.currentTarget.style.background = '#F8F7F4'; }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 text-white py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50" style={{ background: '#F97316' }}>
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm transition-colors" style={{ background: '#F8F7F4', color: '#6B7280', border: '1.5px solid #F0EEE8' }}>
              ביטול
            </button>
          </div>
        </form>
      )}

      {/* Customers sub-tab → guest profiles (from bookings) */}
      {filter === 'לקוח' ? (
        <OwnerGuests ownerId={ownerId} embedded />
      ) : loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
          <div className="text-4xl mb-3">👥</div>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>אין אנשי קשר עדיין</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="rounded-2xl p-4 flex items-center justify-between transition-all hover:shadow-sm" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'rgba(249,115,22,0.12)', color: '#EA580C' }}>
                  {c.name[0]}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: '#1A1A1A' }}>{c.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: '#EA580C' }}>{c.type}</span>
                    {c.category && <span className="text-xs" style={{ color: '#9CA3AF' }}>{c.category}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {c.phone && <a href={`tel:${c.phone}`} className="text-xs flex items-center gap-1 transition-colors" style={{ color: '#6B7280' }}><Phone size={10} />{c.phone}</a>}
                    {c.email && <a href={`mailto:${c.email}`} className="text-xs flex items-center gap-1 transition-colors" style={{ color: '#6B7280' }}><Mail size={10} />{c.email}</a>}
                  </div>
                  {c.notes && <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>{c.notes}</p>}
                </div>
              </div>
              <button onClick={() => handleDelete(c.id)} className="transition-colors flex-shrink-0" style={{ color: '#9CA3AF' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}