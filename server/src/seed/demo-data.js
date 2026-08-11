/**
 * Demo entity payloads — linked to owner/customer ids at seed time.
 */
import { IDS } from './ids.js';

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function isoNow() {
  return new Date().toISOString();
}

/**
 * @param {{ ownerId: string, ownerName: string, customerId: string, customerName: string, customerEmail: string, ownerEmail: string }} ctx
 */
export function buildDemoRecords(ctx) {
  const { ownerId, ownerName, customerId, customerName, customerEmail, ownerEmail } = ctx;
  const z1 = IDS.zimmerGalil;
  const zimmerGolan = IDS.zimmerGolan;

  const checkInSoon = isoDate(7);
  const checkOutSoon = isoDate(10);
  const promoIn = isoDate(14);
  const promoOut = isoDate(17);

  return [
    {
      id: IDS.adminPerm,
      entityType: 'AdminPermission',
      data: {
        email: ownerEmail.toLowerCase(),
        is_primary: true,
        is_active: true,
        allowed_pages: [],
        notes: 'seed demo admin',
        _seed: 'demo',
      },
      createdById: ownerId,
      createdBy: ownerEmail,
    },
    {
      id: z1,
      entityType: 'Zimmer',
      data: {
        name: 'צימר דemo גליל',
        owner_id: ownerId,
        owner_name: ownerName,
        location: 'ראש פינה, הגליל העליון',
        price_per_night: 850,
        weekday_price: 750,
        weekend_price: 950,
        num_rooms: 2,
        max_guests: 6,
        description: 'צימר דמו עם נוף לחרמון — לבדיקת מיגרציה.',
        approval_status: 'אושר',
        images: [],
        seasonal_pricing: [],
        partial_pricing_enabled: false,
        info_summary: 'צימר משפחתי בגליל, jacuzzi, מרפסת.',
        _seed: 'demo',
      },
      createdById: ownerId,
      createdBy: ownerEmail,
    },
    {
      id: zimmerGolan,
      entityType: 'Zimmer',
      data: {
        name: 'צימר דemo גolan',
        owner_id: ownerId,
        owner_name: ownerName,
        location: 'קצרין, רמת הגולן',
        price_per_night: 720,
        weekday_price: 650,
        weekend_price: 820,
        num_rooms: 1,
        max_guests: 4,
        description: 'צימר זוגי בגולן — נתוני דמו.',
        approval_status: 'אושר',
        images: [],
        seasonal_pricing: [],
        partial_pricing_enabled: false,
        _seed: 'demo',
      },
      createdById: ownerId,
      createdBy: ownerEmail,
    },
    {
      id: IDS.bookingPending,
      entityType: 'BookingRequest',
      data: {
        zimmer_id: z1,
        zimmer_name: 'צימר דemo גליל',
        owner_id: ownerId,
        guest_name: 'משפחת כהן',
        guest_phone: '050-1234567',
        check_in: checkInSoon,
        check_out: checkOutSoon,
        num_guests: 4,
        num_adults: 2,
        num_children: 2,
        status: 'ממתינה',
        total_price: 2550,
        _seed: 'demo',
      },
      createdById: customerId,
      createdBy: customerEmail,
    },
    {
      id: IDS.bookingApproved,
      entityType: 'BookingRequest',
      data: {
        zimmer_id: zimmerGolan,
        zimmer_name: 'צימר דemo גolan',
        owner_id: ownerId,
        guest_name: 'דנה לוי',
        guest_phone: '052-9876543',
        check_in: isoDate(-3),
        check_out: isoDate(-1),
        num_guests: 2,
        status: 'אושרה',
        total_price: 1440,
        _seed: 'demo',
      },
      createdById: customerId,
      createdBy: customerEmail,
    },
    {
      id: IDS.promoActive,
      entityType: 'Promotion',
      data: {
        zimmer_id: z1,
        zimmer_name: 'צימר דemo גליל',
        owner_id: ownerId,
        check_in: promoIn,
        check_out: promoOut,
        discount_percent: 15,
        status: 'פעיל',
        _seed: 'demo',
      },
      createdById: ownerId,
      createdBy: ownerEmail,
    },
    {
      id: IDS.sysMsgCustomer,
      entityType: 'SystemMessage',
      data: {
        audience: 'customer',
        category: 'הודעה',
        title: 'ברוכים הבאים ל-Travvin (דמו)',
        body: 'זהו seed לבדיקת התראות לקוח.',
        target_user_ids: [],
        _seed: 'demo',
      },
      createdById: ownerId,
      createdBy: ownerEmail,
    },
    {
      id: IDS.sysMsgOwner,
      entityType: 'SystemMessage',
      data: {
        audience: 'owner',
        category: 'עדכון',
        title: 'הזמנה חדשה ממתינה (דemo)',
        body: 'יש הזמנה ממתינה לאישור בצימר גליל.',
        target_user_ids: [],
        _seed: 'demo',
      },
      createdById: ownerId,
      createdBy: ownerEmail,
    },
    {
      id: IDS.reviewPublished,
      entityType: 'Review',
      data: {
        zimmer_id: zimmerGolan,
        zimmer_name: 'צימר דemo גolan',
        owner_id: ownerId,
        booking_id: IDS.bookingApproved,
        customer_id: customerId,
        customer_name: customerName,
        guest_name: 'דנה לוי',
        check_in: isoDate(-3),
        check_out: isoDate(-1),
        rating: 5,
        text: 'חוויה מעולה! נתוני דמו.',
        images: [],
        status: 'published',
        published_at: isoNow(),
        source: 'ידני',
        _seed: 'demo',
      },
      createdById: customerId,
      createdBy: customerEmail,
    },
    {
      id: IDS.questionPending,
      entityType: 'UnansweredQuestion',
      data: {
        zimmer_id: z1,
        zimmer_name: 'צימר דemo גליל',
        owner_id: ownerId,
        question: 'האם מותר להביא כלב?',
        customer_name: customerName,
        status: 'ממתינה',
        save_to_knowledge: false,
        _seed: 'demo',
      },
      createdById: customerId,
      createdBy: customerEmail,
    },
    {
      id: IDS.chatSession,
      entityType: 'ChatSession',
      data: {
        user_id: customerId,
        user_name: customerName,
        user_email: customerEmail,
        messages: [
          { role: 'user', content: 'מחפש צימר בגליל לסופ״ש', time: isoNow() },
          { role: 'assistant', content: 'מצאתי כמה אפשרויות בגליל!', time: isoNow() },
        ],
        summary: 'חיפוש צימר בגליל',
        zimmer_ids_shown: [z1, zimmerGolan],
        booking_created: false,
        _seed: 'demo',
      },
      createdById: customerId,
      createdBy: customerEmail,
    },
    {
      id: IDS.directChat,
      entityType: 'DirectChat',
      data: {
        zimmer_id: z1,
        zimmer_name: 'צימר דemo גליל',
        customer_id: customerId,
        customer_name: customerName,
        owner_id: ownerId,
        owner_name: ownerName,
        booking_id: IDS.bookingPending,
        messages: [
          { role: 'customer', content: 'שלום, מה שעות הצ׳ק-אין?', time: isoNow() },
        ],
        _seed: 'demo',
      },
      createdById: customerId,
      createdBy: customerEmail,
    },
    {
      id: IDS.contact1,
      entityType: 'Contact',
      data: {
        owner_id: ownerId,
        name: 'משק אורגני הגליל',
        phone: '04-1234567',
        email: 'supplier@example.com',
        type: 'ספק',
        category: 'ארוחות בוקר',
        notes: 'ספק דemo',
        _seed: 'demo',
      },
      createdById: ownerId,
      createdBy: ownerEmail,
    },
    {
      id: IDS.customerProfile,
      entityType: 'CustomerProfile',
      data: {
        user_id: customerId,
        user_name: customerName,
        user_email: customerEmail,
        phone: '050-0000001',
        vacation_preferences: 'טבע, שקט, jacuzzi',
        preferred_regions: 'גליל, גולן',
        num_guests_usual: 4,
        _seed: 'demo',
      },
      createdById: customerId,
      createdBy: customerEmail,
    },
    {
      id: IDS.syncState,
      entityType: 'SyncState',
      data: {
        owner_id: ownerId,
        provider: 'google',
        sync_token: null,
        last_sync_at: null,
        last_sync_attempt: null,
        last_status: 'ok',
        auto_sync: false,
        _seed: 'demo',
      },
      createdById: ownerId,
      createdBy: ownerEmail,
    },
  ];
}
