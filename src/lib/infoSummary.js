// Helpers for the curated info summary shown to customers (and identical in the owner view).

export function zonesSignature(zones = []) {
  try {
    return JSON.stringify((zones || []).map(z => [z.content || '', z.source_type || '', z.source_label || '', z.source_date || '']));
  } catch (e) {
    return '';
  }
}

// True when a summary exists but the data zones changed since it was last synced
// (new zone added from an answered question / chat, or an existing zone edited).
export function isSummaryStale(zimmer) {
  if (!zimmer?.info_summary || !zimmer?.info_summary_snapshot) return false;
  return zonesSignature(zimmer?.data_zones) !== zimmer.info_summary_snapshot;
}