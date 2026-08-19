/**
 * Clock parts in Asia/Jerusalem — stay/supplier scanners.
 * @param {Date} [now]
 */
export function israelNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    day: '2-digit',
  }).formatToParts(now);
  const pick = (t) => parts.find((p) => p.type === t)?.value;
  let hour = parseInt(pick('hour') || '0', 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(pick('minute') || '0', 10);
  const day = parseInt(pick('day') || '1', 10);
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[pick('weekday')] ?? -1;
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
  }).format(now);
  return { now, hour, minute, day, dow, todayStr };
}
