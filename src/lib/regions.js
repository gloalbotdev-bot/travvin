// Macro-region options shown to customers in the search widget.
export const REGION_OPTIONS = ['צפון', 'דרום', 'מרכז', 'אילת'];

// Keyword maps: a zimmer's free-text `location` matches a macro-region when
// it contains any of that region's keywords.
export const REGION_KEYWORDS = {
  'צפון': [
    'גליל', 'גולן', 'כנרת', 'טבריה', 'ראש פינה', 'צפת', 'נהריה', 'עכו',
    'קרית שמונה', 'קריית שמונה', 'מטולה', 'מעלות', 'כרמיאל', 'חורפיש',
    'פקיעין', 'יסוד המעלה', 'ראש הנקרה', 'כפר כמא', 'דלתון', 'יודפת',
    'עמק הירדן', 'עמק בית שאן', 'בקעת כינרות', 'גמלא', 'חרמון', 'החרמון',
    'תל חי', 'כפר גלעדי', 'פוריה', 'כפר תבור', 'מירון', 'עכברה', 'חמדת',
    'קדש נפתלי', 'חלץ', 'מצפה שלם', 'קלעים', 'נאעור', 'מעונה', 'שזור',
    'מושבה עלית', 'כרם בן זמרה', 'צלמון', 'חוקוק', 'קדרים', 'שיבולים', 'לבנים',
    'ביריה', 'צפת העתיקה', 'קיבוץ', 'מושב'
  ],
  'דרום': [
    'נגב', 'באר שבע', 'דימונה', 'ערבה', 'מצפה רמון', 'אשקלון', 'אשדוד',
    'סדום', 'ים המלח', 'מצדה', 'עין גדי', 'עין בוקק', 'ערד', 'להבים',
    'אופקים', 'נתיבות', 'שדרות', 'אשכול', 'בארי', 'חלוץ', 'מגדל', 'פארן',
    'צופר', 'עין יהב', 'ספיר', 'נבטים', 'רהט', 'קרית גת', 'קרית מלאכי',
    'באר טוביה', 'ניצנה', 'כסיפה', 'תראבין', 'ירוחם', 'שגב', 'לקיה'
  ],
  'מרכז': [
    'תל אביב', 'ירושלים', 'הרצליה', 'נתניה', 'רעננה', 'כפר סבא', 'רמת גן',
    'פתח תקווה', 'מודיעין', 'ראשון לציון', 'חולון', 'בת ים', 'רחובות',
    'השרון', 'גוש דן', 'גבעתיים', 'בני ברק', 'אלעד', 'נס ציונה', 'באר יעקב',
    'לוד', 'רמלה', 'שוהם', 'אבו גוש', 'אור יהודה', 'כפר חב', 'ראש העין',
    'טירת כרמל', 'בנימינה', 'זכרון יעקב', 'בנימינה גבעת עדה', 'קיסריה', 'חדרה'
  ],
  'אילת': ['אילת', 'אילות', 'חוף האלמוגים', 'שחרות', 'באר אורה', 'נווה חריף', 'צוקים', 'שלומית', 'באר מילכה', 'תמר']
};

// Returns true if a zimmer's location belongs to the given macro-region.
export function locationMatchesRegion(location, region) {
  if (!location || !region) return false;
  const loc = String(location).trim();
  if (!loc) return false;
  const kws = REGION_KEYWORDS[region] || [];
  return kws.some(kw => loc.includes(kw));
}

// Returns the list of macro-regions a zimmer's location matches.
export function regionsForLocation(location) {
  return REGION_OPTIONS.filter(r => locationMatchesRegion(location, r));
}