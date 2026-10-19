import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { collectCustomBedTypes } from '@/lib/rooms';

// Owner-defined bed types (e.g. "פוטון") gathered from all of the owner's zimmers.
export function useOwnerCustomBedTypes(ownerId) {
  const [types, setTypes] = useState([]);

  useEffect(() => {
    if (!ownerId) { setTypes([]); return undefined; }
    let alive = true;
    api.entities.Zimmer.filter({ owner_id: ownerId })
      .then((zimmers) => { if (alive) setTypes(collectCustomBedTypes(zimmers)); })
      .catch(() => { if (alive) setTypes([]); });
    return () => { alive = false; };
  }, [ownerId]);

  return types;
}
