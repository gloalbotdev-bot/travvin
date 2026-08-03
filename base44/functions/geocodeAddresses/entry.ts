import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const addresses = Array.isArray(body?.addresses)
      ? body.addresses.map((a) => String(a || '').trim()).filter(Boolean)
      : [];

    const results = [];
    for (const addr of addresses) {
      try {
        const url =
          'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=il&q=' +
          encodeURIComponent(addr);
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ZimmerBot/1.0 (desktop-search)' },
        });
        const json = await res.json();
        if (Array.isArray(json) && json[0] && json[0].lat && json[0].lon) {
          results.push({
            address: addr,
            lat: parseFloat(json[0].lat),
            lng: parseFloat(json[0].lon),
          });
        } else {
          results.push({ address: addr, lat: null, lng: null });
        }
      } catch (_e) {
        results.push({ address: addr, lat: null, lng: null });
      }
    }
    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});