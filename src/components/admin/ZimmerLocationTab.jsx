import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/api/client';
import { MapPin, Navigation, Crosshair, Search, Loader2 } from 'lucide-react';

const inputStyle = { background: '#F8F7F4', border: '1.5px solid #E8E5E0', color: '#1A1A1A', borderRadius: '12px' };
const onF = (e) => { e.currentTarget.style.borderColor = '#F97316'; e.currentTarget.style.background = '#fff'; };
const onB = (e) => { e.currentTarget.style.borderColor = '#E8E5E0'; e.currentTarget.style.background = '#F8F7F4'; };

const DEFAULT_CENTER = [31.7683, 35.2137]; // Israel

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" fill="#F97316" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function parseAddress(addr, city) {
  if (!addr) return { street: '', house: '' };
  let firstPart = String(addr).split(',')[0].trim();
  if (city && firstPart.endsWith(city)) firstPart = firstPart.slice(0, -city.length).trim().replace(/[, ]+$/, '');
  const m = firstPart.match(/^(.*?)\s+(\d[\dא-ד]*)\s*$/);
  if (m) return { street: m[1].trim(), house: m[2].trim() };
  return { street: firstPart, house: '' };
}

function buildAddress(city, street, house) {
  const parts = [];
  if (street && house) parts.push(`${street} ${house}`);
  else if (street) parts.push(street);
  else if (house) parts.push(`בית ${house}`);
  if (city) parts.push(city);
  return parts.join(', ');
}

function Recenter({ lat, lng }) {
  const map = useMap();
  if (lat != null && lng != null) map.setView([lat, lng], map.getZoom() > 14 ? map.getZoom() : 15, { animate: true });
  return null;
}

function MapClicker({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function ZimmerLocationTab({ location, staySettings, onUpdate }) {
  const ss = staySettings || {};
  const parsed = parseAddress(ss.address, location);
  const [city, setCity] = useState(location || '');
  const [street, setStreet] = useState(parsed.street || '');
  const [house, setHouse] = useState(parsed.house || '');
  const [lat, setLat] = useState(ss.lat ?? null);
  const [lng, setLng] = useState(ss.lng ?? null);
  const [mapOpen, setMapOpen] = useState(false);
  const [addrSearch, setAddrSearch] = useState('');
  const [searching, setSearching] = useState(false);

  const commit = (next) => {
    const c = next.city != null ? next.city : city;
    const s = next.street != null ? next.street : street;
    const h = next.house != null ? next.house : house;
    const la = next.lat != null ? next.lat : lat;
    const ln = next.lng != null ? next.lng : lng;
    const addr = buildAddress(c, s, h);
    const nav = (la != null && ln != null) ? `https://waze.com/ul?ll=${la},${ln}&navigate=yes` : (ss.nav_link || '');
    onUpdate({ location: c || '', staySettings: { ...ss, address: addr, lat: la, lng: ln, nav_link: nav } });
  };

  const onPick = async (la, ln) => {
    setLat(la); setLng(ln);
    commit({ lat: la, lng: ln });
    try {
      const res = await api.functions.invoke('searchIsraelAddresses', { mode: 'reverse', lat: la, lng: ln });
      const body = res?.data || res;
      const c = body?.city || city;
      const s = body?.street || street;
      const h = body?.house || house;
      setCity(c); setStreet(s); setHouse(h);
      commit({ city: c, street: s, house: h, lat: la, lng: ln });
    } catch { /* keep coords only */ }
  };

  const [searchMsg, setSearchMsg] = useState('');

  const searchAddress = async () => {
    const q = addrSearch.trim();
    if (!q) return;
    setSearching(true);
    setSearchMsg('');
    try {
      const res = await api.functions.invoke('geocodeAddresses', { addresses: [q] });
      const body = res?.data || res;
      const r = body?.results?.[0];
      if (r && r.lat) { onPick(r.lat, r.lng); setAddrSearch(''); }
      else setSearchMsg('לא נמצאה כתובת — נסה להקליד עיר ורחוב מלאים.');
    } catch (e) {
      setSearchMsg('שגיאה בחיפוש — נסה שוב.');
      console.error('geocodeAddresses failed', e);
    }
    setSearching(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => onPick(pos.coords.latitude, pos.coords.longitude), () => {});
  };

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <h2 className="font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#0B3838' }}>
          <MapPin size={13} /> כתובת ומיקום
        </h2>
        <p className="text-xs mb-4 leading-relaxed" style={{ color: '#9CA3AF' }}>
          הזן כתובת חופשית וסמן את הנקודה המדויקת על המפה — הנקודה מאפשרת ניווט לאורחים.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>עיר / ישוב</label>
            <input value={city} onChange={(e) => { setCity(e.target.value); commit({ city: e.target.value }); }}
              placeholder="עיר / אזור"
              className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={onF} onBlur={onB} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>רחוב</label>
              <input value={street} onChange={(e) => { setStreet(e.target.value); commit({ street: e.target.value }); }}
                placeholder="שם הרחוב"
                className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={onF} onBlur={onB} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: '#6B7280' }}>מספר בית</label>
              <input value={house} onChange={(e) => { setHouse(e.target.value); commit({ house: e.target.value }); }}
                placeholder="12"
                className="w-full px-4 py-3 text-sm outline-none transition-all" style={inputStyle} onFocus={onF} onBlur={onB} />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl p-3 flex items-center gap-2" style={{ background: '#F8F7F4', border: '1.5px solid #F0EEE8' }}>
          <MapPin size={14} style={{ color: '#F97316' }} />
          <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{buildAddress(city, street, house) || 'הכתובת תיווצר כאן'}</span>
        </div>
      </section>

      <section className="rounded-2xl p-6" style={{ background: '#fff', border: '1.5px solid #F0EEE8' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: '#0B3838' }}>
            <Crosshair size={13} /> מיקום מדויק על המפה
            {lat == null && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>חסר מיקום</span>}
          </h2>
          <button type="button" onClick={useMyLocation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(11,56,56,0.08)', color: '#0B3838' }}>
            <Navigation size={12} /> המיקום שלי
          </button>
        </div>

        <button type="button" onClick={() => setMapOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all mb-3"
          style={{ background: mapOpen ? '#0B3838' : 'rgba(11,56,56,0.08)', color: mapOpen ? '#fff' : '#0B3838', border: '1.5px solid #0B3838' }}>
          <MapPin size={15} /> {mapOpen ? 'סגור מפה' : 'פתח מפה לבחירת מיקום'}
        </button>

        {mapOpen && (
          <>
          <div className="flex gap-2 mb-3">
            <input
              value={addrSearch}
              onChange={(e) => setAddrSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchAddress(); } }}
              placeholder="חפש כתובת למיקום במפה…"
              className="flex-1 px-4 py-2.5 text-sm outline-none transition-all"
              style={inputStyle} onFocus={onF} onBlur={onB}
            />
            <button type="button" onClick={searchAddress} disabled={searching}
              className="px-4 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: '#0B3838', color: '#fff' }}>
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} חפש
            </button>
          </div>
          {searchMsg && <p className="text-xs mb-2" style={{ color: '#D97706' }}>{searchMsg}</p>}
          <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #E5E7EB' }}>
            <MapContainer
              center={(lat != null && lng != null) ? [lat, lng] : DEFAULT_CENTER}
              zoom={(lat != null && lng != null) ? 15 : 7}
              style={{ height: 320, width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClicker onPick={onPick} />
              <Recenter lat={lat} lng={lng} />
              {lat != null && lng != null && (
                <Marker position={[lat, lng]} icon={pinIcon} draggable
                  eventHandlers={{ dragend: (e) => { const m = e.target; onPick(m.getLatLng().lat, m.getLatLng().lng); } }} />
              )}
            </MapContainer>
          </div>
          </>
        )}

        {lat != null && lng != null ? (
          <p className="text-xs mt-3" style={{ color: '#6B7280' }}>
            נקודה: {lat.toFixed(5)}, {lng.toFixed(5)} · <a href={`https://waze.com/ul?ll=${lat},${lng}`} target="_blank" rel="noreferrer" className="font-semibold" style={{ color: '#EA580C' }}>פתח ב-Waze</a>
          </p>
        ) : (
          <p className="text-xs mt-3 font-medium" style={{ color: '#D97706' }}>חסר מיקום מדויק — לחץ על המפה כדי לסמן את הנקודה ולאפשר ניווט לאורחים.</p>
        )}
      </section>
    </div>
  );
}