import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = L.divIcon({
  className: 'zimmer-pin',
  html: '<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:#F97316;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);color:#fff;font-size:13px">🏠</span></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -28],
});

const selectedIcon = L.divIcon({
  className: 'zimmer-pin zimmer-pin-selected',
  html: '<div style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;background:#EA580C;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 12px rgba(234,88,12,.5)"><span style="transform:rotate(45deg);color:#fff;font-size:16px">🏠</span></div>',
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -36],
});

function FlyToSelected({ selected }) {
  const map = useMap();
  useEffect(() => {
    if (selected?.lat && selected?.lng) {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
    }
  }, [selected?.id]);
  return null;
}

export default function SearchMap({ zimmers, selectedId, onSelect }) {
  const withCoords = zimmers.filter((z) => z.lat && z.lng);
  const selected = withCoords.find((z) => z.id === selectedId);
  const center = selected ? [selected.lat, selected.lng] : [31.5, 34.95];

  return (
    <div className="h-full w-full rounded-3xl overflow-hidden" dir="rtl">
      <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%', background: '#F5F5F5' }} scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {withCoords.map((z) => (
          <Marker
            key={z.id}
            position={[z.lat, z.lng]}
            icon={z.id === selectedId ? selectedIcon : pinIcon}
            eventHandlers={{ click: () => onSelect(z) }}
          >
            <Popup>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{z.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{z.location || '—'}</div>
                {z.price_per_night ? <div style={{ fontSize: 13, color: '#EA580C', fontWeight: 600 }}>{z.price_per_night}₪ / לילה</div> : null}
                <button onClick={() => onSelect(z)} style={{ marginTop: 6, background: '#F97316', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>פרטים</button>
              </div>
            </Popup>
          </Marker>
        ))}
        <FlyToSelected selected={selected} />
      </MapContainer>
    </div>
  );
}