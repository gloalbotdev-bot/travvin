/**
 * User-facing message for booking API errors (M15 #9 overlap etc.).
 */
export function bookingErrorMessage(err, fallback = 'לא הצלחתי לשמור את הבקשה. נסה שוב.') {
  if (!err) return fallback;
  if (err.status === 409 || err.data?.error === 'booking_overlap') {
    return err.data?.message || err.message || 'התאריכים תפוסים — קיימת הזמנה מאושרת חופפת';
  }
  return err.message || fallback;
}
