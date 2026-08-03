import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Phone, Mail, Trash2, Users, Wrench } from 'lucide-react';

const EMPTY_FORM = { name: '', phone: '', email: '', type: 'לקוח', category: '', notes: '' };

export default function ContactsBook({ ownerId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('הכל');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ownerId) load();
  }, [ownerId]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Contact.filter({ owner_id: ownerId });
    setContacts(data);
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Contact.create({ ...form, owner_id: ownerId });
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק איש קשר?')) return;
    await base44.entities.Contact.delete(id);
    load();
  };

  const filtered = filter === 'הכל' ? contacts : contacts.filter(c => c.type === filter);
  const supplierCount = contacts.filter(c => c.type === 'ספק').length;
  const customerCount = contacts.filter(c => c.type === 'לקוח').length;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">אנשי קשר</h1>
          <p className="text-gray-400 text-sm mt-1">{supplierCount} ספקים · {customerCount} לקוחות</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> הוסף
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['הכל', 'ספק', 'לקוח'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? 'bg-[#25D366]/20 text-[#25D366]' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {f === 'ספק' ? <><Wrench size={12} className="inline ml-1" />ספקים ({supplierCount})</> :
             f === 'לקוח' ? <><Users size={12} className="inline ml-1" />לקוחות ({customerCount})</> : 'הכל'}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-gray-900 border border-[#25D366]/40 rounded-2xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-4">הוספת איש קשר</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="שם *"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
              />
            </div>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="טלפון"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
            />
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="אימייל"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
            />
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
            >
              <option value="לקוח">לקוח</option>
              <option value="ספק">ספק</option>
            </select>
            <input
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="קטגוריה (ניקיון, אינסטלציה...)"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366]"
            />
            <div className="col-span-2">
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="הערות"
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#25D366] resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-gray-700 text-gray-300 rounded-xl text-sm hover:bg-gray-600 transition-colors">
              ביטול
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-gray-700 border-t-[#25D366] rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">👥</div>
          <p>אין אנשי קשר עדיין</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${c.type === 'ספק' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  {c.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.type === 'ספק' ? 'bg-orange-400/10 text-orange-400' : 'bg-blue-400/10 text-blue-400'}`}>{c.type}</span>
                    {c.category && <span className="text-xs text-gray-500">{c.category}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-gray-400 hover:text-[#25D366] flex items-center gap-1"><Phone size={10} />{c.phone}</a>}
                    {c.email && <a href={`mailto:${c.email}`} className="text-xs text-gray-400 hover:text-[#25D366] flex items-center gap-1"><Mail size={10} />{c.email}</a>}
                  </div>
                  {c.notes && <p className="text-xs text-gray-500 mt-1">{c.notes}</p>}
                </div>
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}