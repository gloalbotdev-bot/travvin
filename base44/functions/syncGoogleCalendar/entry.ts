import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Webhook path: body.data._provider_meta exists («sync» ack on first registration)
    const isWebhook = body?.data?._provider_meta;
    if (isWebhook) {
      const state = body.data._provider_meta['x-goog-resource-state'];
      if (state === 'sync') return Response.json({ status: 'sync_ack' });
    }

    const fromWorkflow = body?._from_workflow === true;

    // Scheduled auto-sync from a workflow — gated by SyncState.auto_sync, no user auth needed
    if (fromWorkflow) {
      const existing = await base44.asServiceRole.entities.SyncState.list();
      const syncRecord = existing.length > 0 ? existing[0] : null;
      if (!syncRecord?.auto_sync) return Response.json({ status: 'skipped', reason: 'auto_sync_disabled' });
    } else if (!isWebhook) {
      // Manual invocation from the dashboard should still be authenticated
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const existing = await base44.asServiceRole.entities.SyncState.list();
    const syncRecord = existing.length > 0 ? existing[0] : null;

    let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=100&singleEvents=true';
    if (syncRecord?.sync_token) {
      url += `&syncToken=${syncRecord.sync_token}`;
    } else {
      url += '&timeMin=' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    let res = await fetch(url, { headers: authHeader });
    if (res.status === 410) {
      // syncToken expired — fresh sync
      url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=100&singleEvents=true'
        + '&timeMin=' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      res = await fetch(url, { headers: authHeader });
    }
    if (!res.ok) {
      const errText = await res.text();
      if (syncRecord) {
        await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
          last_sync_at: new Date().toISOString(),
          last_status: 'error',
          last_error: errText.slice(0, 500)
        });
      }
      return Response.json({ status: 'api_error', error: errText }, { status: 502 });
    }

    // Drain all pages — nextSyncToken only appears on the last page
    const allItems = [];
    let pageData = await res.json();
    let newSyncToken = pageData.nextSyncToken || null;
    while (true) {
      allItems.push(...(pageData.items || []));
      if (pageData.nextSyncToken) newSyncToken = pageData.nextSyncToken;
      if (!pageData.nextPageToken) break;
      const nextRes = await fetch(url + `&pageToken=${pageData.nextPageToken}`, { headers: authHeader });
      if (!nextRes.ok) break;
      pageData = await nextRes.json();
    }

    // Reconcile changed events with BookingRequest records
    let updated = 0;
    for (const ev of allItems) {
      if (ev.status === 'cancelled') {
        // event was deleted in Google — disconnect from any booking
        try {
          const matches = await base44.asServiceRole.entities.BookingRequest.filter({ calendar_event_id: ev.id });
          for (const b of matches) {
            await base44.asServiceRole.entities.BookingRequest.update(b.id, { calendar_event_id: null });
            updated++;
          }
        } catch (_) { /* ignore single-event errors */ }
        continue;
      }

      const startStr = ev.start?.date || (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : null);
      const endStr = ev.end?.date || (ev.end?.dateTime ? ev.end.dateTime.slice(0, 10) : null);
      if (!startStr || !endStr) continue;

      try {
        const matches = await base44.asServiceRole.entities.BookingRequest.filter({ calendar_event_id: ev.id });
        for (const b of matches) {
          const updates = {};
          if (b.check_in !== startStr) updates.check_in = startStr;
          if (b.check_out !== endStr) updates.check_out = endStr;
          if (Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.BookingRequest.update(b.id, updates);
            updated++;
          }
        }
      } catch (_) { /* ignore single-event errors */ }
    }

    const now = new Date().toISOString();
    if (syncRecord) {
      await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
        sync_token: newSyncToken || syncRecord.sync_token,
        last_sync_at: now,
        last_status: 'ok',
        last_error: null
      });
    } else if (newSyncToken) {
      await base44.asServiceRole.entities.SyncState.create({
        sync_token: newSyncToken,
        last_sync_at: now,
        last_status: 'ok'
      });
    }

    return Response.json({ status: 'ok', processed: allItems.length, updated, last_sync_at: now });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}