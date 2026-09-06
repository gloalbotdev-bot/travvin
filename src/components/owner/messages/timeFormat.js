// Compact timestamp like the messages UI: "10:25" today, "אתמול", weekday, or "20.8".
export function fmtMsgTime(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date)) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'אתמול';
  const diffDays = Math.round((now - date) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString('he-IL', { weekday: 'long' });
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}