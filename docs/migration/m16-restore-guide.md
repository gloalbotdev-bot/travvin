# M16 — מדריך שחזור סוכן `zimmer_manager`

תאריך תיעוד: 2026-08-09 (עודכן 2026-09-02 — §6 עדכוני Base44 a9dba46)  
סטטוס מוצר: **נדחה לבדיקת מצב קיים** (לא מבוטל לנצח).  
הכרעה נוכחית: [decisions.md](./decisions.md) §1.

מטרת הקובץ: כשתחליטי לחזור — יהיה ברור **מה היה**, **מה חסר היום**, **מה Base44 הוסיפה מאז**, ו**מה לבנות**.

---

## 1. מה היה במוצר

| פריט | פרטים |
|---|---|
| UI | `/owner` → טאב `assistant` → `OwnerAgentChat.jsx` |
| Runtime | Base44 `base44.agents.*` |
| הגדרת סוכן | `base44/agents/zimmer_manager.jsonc` (נמחק ב־M14; **ב־git history**) |
| מצבים | מידע (קריאה בלבד) / עריכה (כתיבה) — קידומת `[מצב: מידע]` / `[מצב: עריכה]` בהודעה |

### מתודות SDK שהיו בשימוש

- `listConversations`
- `createConversation`
- `getConversation`
- `subscribeToConversation`
- `addMessage`

### ישויות + פעולות שהסוכן הורשה (מ־`tool_configs`)

| ישות | create | read | update | delete |
|---|---|---|---|---|
| Zimmer | ✓ | ✓ | ✓ | ✓ |
| BookingRequest | ✓ | ✓ | ✓ | ✓ |
| UnansweredQuestion | — | ✓ | ✓ | ✓ |
| DirectChat | — | ✓ | ✓ | — |
| Promotion | ✓ | ✓ | ✓ | ✓ |
| Contact | ✓ | ✓ | ✓ | ✓ |
| Review | — | ✓ | — | — |
| CustomerProfile | — | ✓ | — | — |
| SystemMessage | — | ✓ | — | — |

### פונקציות שרת שהסוכן יכול היה לקרוא

- `addBookingToCalendar` (אחרי יצירה/אישור הזמנה)
- `syncGoogleCalendar` (רק אם המשתמש מבקש במפורש)
- `pushInAppNotification` (רק אם יש צורך מפורש)

### התנהגות חשובה (סיכון)

- במצב עריכה: פעולות (כולל מחיקה לפי הקונפיג) רצו **מיד**, בלי preview UI.
- אכיפת info/edit הייתה בעיקר ב־prompt / קידומת הודעה — **לא** בשרת (פריט deferred-fixes #16).

---

## 2. מה יש היום אחרי הזניחה

| פריט | מצב |
|---|---|
| טאב `assistant` ב־`/owner` | **קיים** |
| UI בטאב | `OwnerInfoAssistant.jsx` (InvokeLLM + `executeOwnerAssistantOp`) |
| פעולות מהצ'אט | `create_zimmer` / `update_zimmer` / `create_booking` (whitelist שרת) |
| שיפורי UI מתוכננים (port a9dba46) | קול, auto-focus, textarea, overlay היסטוריה — **בלי** agents |
| `OwnerAgentChat.jsx` | נמחק ב־M13 — גרסה מעודכנת ב־`base44/main` (ראה §6) |
| `zimmer_manager.jsonc` | נמחק ב־M14 — **קיים** ב־vendor `base44/main` |
| `base44.agents.*` | אין — צריך runtime עצמאי |

שחזור מ־git (דוגמה):

```bash
git log --oneline -- src/components/owner/OwnerAgentChat.jsx
git show <commit>:src/components/owner/OwnerAgentChat.jsx

# גרסה עדכנית (vendor, כולל §6):
git show base44/main:src/components/owner/OwnerAgentChat.jsx

git log --oneline -- base44/agents/zimmer_manager.jsonc
git show <commit>:base44/agents/zimmer_manager.jsonc
git show base44/main:base44/agents/zimmer_manager.jsonc
```

---

## 3. מה לבנות כשחוזרים (סדר מומלץ)

### א. הכרעה מוצר (חובה לפני קוד)

1. שחזור **1:1** לסוכן הישן, או  
2. **הרחבה הדרגתית** של `OwnerInfoAssistant` (פעולות נבחרות + אישור לפני מחיקה) — לרוב עדיף.

אם בוחרים 1:1 / runtime מלא:

### ב. Backend

1. `server/src/lib/agent-runtime.js` — לולאת מודל + tool-calling לפי קונפיג הסוכן  
2. `server/src/routes/agents.js` — חוזה כמו ה־SDK:
   - שיחות: list / create / get
   - הודעות: addMessage
   - אירועי שיחה (SSE או polling; תשתית realtime כבר קיימת ל־entities)
3. אחסון שיחות/הודעות (טבלת Prisma חדשה או JSONB)  
4. הרשאות כלים ב**שרת** (לא רק prompt): whitelist לפי מצב info/edit  
5. חיבור לכלים:
   - entity store (create/update/delete/read) לפי הטבלה למעלה  
   - `addBookingToCalendar` / `syncGoogleCalendar` / `pushInAppNotification`
6. ספק LLM: Gemini (כמו M10) — לא OpenAI אלא אם יוחלט אחרת

### ג. Frontend

1. לשחזר `OwnerAgentChat.jsx` (או למזג לתוך הטאב במקום/ליד `OwnerInfoAssistant`)  
2. `src/api/own/agents.js` + חיבור ב־`src/api/client.js`  
3. להחליט: טאב אחד עם שני מצבים, או רק הסוכן המלא

### ד. אבטחה (לא לדלג)

- **לא** לאפשר delete בלי אישור משתמש מפורש ב־UI (שיפור מול Base44)  
- אכיפת מצב info/edit בשרת  
- בעלים רואה/משנה רק נתונים של `owner_id` שלו  
- לסגור/להגביל `pushInAppNotification` מקריאות לקוח רגילות (קשור גם ל־M15 #4/#24)

### ה. אימות

- [ ] שיחה בטאב assistant  
- [ ] מעבר info ↔ edit  
- [ ] לפחות כלי אחד על ישות (למשל עדכון מחיר צימר)  
- [ ] מחיקה (אם מאושרת) דורשת אישור  
- [ ] unsubscribe / ניתוק אחרי unmount  
- [ ] אין גישה לנתוני בעלים אחר

**היקף משוער:** 5–8 ימים לשחזור נאמן; פחות אם רק מרחיבים את `OwnerInfoAssistant`.

---

## 4. קבצי ייחוס ב־git / docs

- קונפיג סוכן: `base44/agents/zimmer_manager.jsonc` (היסטוריית git)  
- UI ישן: `src/components/owner/OwnerAgentChat.jsx` (היסטוריית git)  
- תוכנית: `docs/migration-plan.md` § מילסטון 16  
- חוזה API: `docs/migration/api-contract.md` § Agents  
- סיכונים: deferred-fixes #16; PROJECT_MASTER R4

---

## 5. אלטרנטיבה מומלצת לפני M16 מלא

אם אחרי בדיקת שימוש חסרות רק פעולות ספציפיות מהצ’אט — להרחיב `OwnerInfoAssistant`:

דוגמאות עדיפות גבוהה: אישור/דחיית הזמנה, מענה ל־UnansweredQuestion, יצירת Promotion.

זה זול ובטוח יותר מ־runtime סוכנים מלא.

---

## 6. עדכוני Base44 מאז הסבב הראשון (121d851 → a9dba46)

**תאריך סקירה:** 2026-09-02  
**מקור:** `git diff 121d851..base44/main` על קבצים הקשורים לעוזר בעלים  
**סבב port-base44 מתוכנן:** `.cursor/plans/base44_port_a9dba46_c5ed9337.plan.md` — **לא** משחזר M16; מרחיב `OwnerInfoAssistant` ב-UI בלבד

### 6.1 מה Base44 שינתה בעוזר (לעומת M13/M14)

Base44 **לא** ויתרה על `OwnerAgentChat` — להפך, הרחיבה אותו משמעותית והחזירה אותו לטאב `assistant` ב־`/owner` (במקום `OwnerInfoAssistant`).

| פריט | לפני (121d851 / Travvin M13) | אחרי (a9dba46 / Base44) |
|---|---|---|
| רכיב בטאב assistant | `OwnerAgentChat` (גרסה בסיסית) | `OwnerAgentChat` **+366 שורות** |
| דף בית בעלים | לא היה | `OwnerAssistantHome` — שדה מהיר + קיצורי דרך → `initialPrompt` לעוזר |
| היסטוריית שיחות | לא | ישות **`OwnerConversation`** + overlay (`ChatHistoryOverlay`) |
| פיצול שיחה ארוכה | לא | `summarizeConversation` + ארכוב/נעילה + carry-over summary |
| קול | לא | `MicButton` + `useVoiceInput` |
| תיבת קלט | קבועה | `useAutoResize` (עד ~240px) |
| auto-focus | לא | פוקוס אוטומטי אחרי טעינה |
| Markdown בתשובות | חלקי | `ReactMarkdown` |
| תצוגת tools | בסיסית | `ToolCallDisplay` מורחב (סטטוס, פרמטרים, תוצאות) |
| קונפיג סוכן | `zimmer_manager.jsonc` | **עדיין קיים** ב־`base44/agents/zimmer_manager.jsonc` (vendor) |

### 6.2 קבצים חדשים/משתנים — ייחוס ל־M16

```bash
# OwnerAgentChat המעודכן (vendor)
git show base44/main:src/components/owner/OwnerAgentChat.jsx

# ישות היסטוריה (נדרשת רק ל-runtime agents)
git show base44/main:base44/entities/OwnerConversation.jsonc

# פונקציות תומכות לשיחות ארוכות
git show base44/main:base44/functions/summarizeConversation/entry.ts
git show base44/main:base44/functions/splitCustomerChat/entry.ts

# דף בית שמזין את העוזר (לא חלק מ-M16 — UI בלבד)
git show base44/main:src/components/owner/OwnerAssistantHome.jsx

# קונפיג סוכן עדכני
git show base44/main:base44/agents/zimmer_manager.jsonc
```

**Hooks/libs משותפים** (רלוונטיים גם להרחבת `OwnerInfoAssistant` בלי M16):

- `src/hooks/useVoiceInput.js`, `src/hooks/useAutoResize.js`
- `src/components/chat/MicButton.jsx`, `src/components/chat/ChatHistoryOverlay.jsx`
- `src/lib/chatHistory.js` (`MESSAGE_LIMIT`, `HISTORY_PAGE_SIZE`, `isArchivable`, …)

### 6.3 OwnerConversation — מה היא עושה

| שדה / התנהגות | מטרה |
|---|---|
| `owner_id`, `conversation_id` | קישור בין בעלים ל־`base44.agents` conversation |
| `title`, `archived`, `locked` | ניהול היסטוריה — שיחות ישנות ננעלות |
| `carry_over_summary` | סיכום שעובר לשיחה חדשה אחרי split |
| RLS | owner רואה רק שלו; admin רואה הכל |

**ב־Travvin:** אין `OwnerConversation` ואין `agents` API. אם חוזרים ל-M16 — צריך טבלה/ישות + routes. אם נשארים עם `OwnerInfoAssistant` — אפשר היסטוריה ב־`ChatSession` (profile=`owner_assistant`) או localStorage; **לא** חובה לשחזר את הישות 1:1.

### 6.4 פונקציות שרת חדשות (רק לסוכן / היסטוריה)

| פונקציה | תפקיד | נדרש ל-M16? |
|---|---|---|
| `summarizeConversation` | סיכום הודעות לפני ארכוב | כן, אם מעתיקים split/history של Base44 |
| `splitCustomerChat` | פיצול שיחת לקוח (לא owner) | **לא** ל-M16 — שונה מ־OwnerConversation |
| `appendChatMessage` | append ל־ChatSession | אופציונלי — תלוי באחסון היסטוריה |

ב־Travvin: לתרגם ל־Node + Gemini (לא `@base44/sdk`); לא לחשוף `summarizeConversation` ללא auth owner.

### 6.5 מה נ decided בסבב port a9dba46 (לא M16)

בסקירת port-base44 2026-09-02 **אושר**:

1. **לא** לשחזר `OwnerAgentChat` / `zimmer_manager` בסבב זה.
2. **כן** להעביר ל־`OwnerInfoAssistant`: קול, auto-focus, textarea מתרחב, overlay היסטוריה (אם feasible).
3. **כן** להעביר `OwnerAssistantHome` + layout חדש של `OwnerPanel` — אבל טאב `assistant` נשאר `OwnerInfoAssistant`.
4. שאר העדכון (Discover, GuestProfile, יומן…) — בשלבים נפרדים; ראה תוכנית port.

**משמעות ל-M16:** אחרי סבב port, `OwnerInfoAssistant` יקבל חלק מ"עטיפת" ה-UI של `OwnerAgentChat`, אבל **לא** את runtime ה-agents. כשתחליטי על M16 — §6.1 מפרט מה **עוד** חסר מעבר ל-UI (agents API, tools, OwnerConversation, summarize).

### 6.6 טבלת השוואה — שלוש דרכים אפשריות כשחוזרים

| | A. M16 מלא (1:1 + §6) | B. הרחבת OwnerInfoAssistant | C. היברידי |
|---|---|---|---|
| UI | `OwnerAgentChat` + §6 hooks | `OwnerInfoAssistant` + §6 hooks | `OwnerInfoAssistant` + דף בית |
| Runtime | `agent-runtime` + `agents.js` | `api.assistant.chat` + `executeOwnerAssistantOp` | B + tools מוגבלים בשרת |
| היסטוריה | `OwnerConversation` | `ChatSession` / overlay | כמו B |
| היקף | 8–12 ימים (כולל §6) | 2–4 ימים לפעולות נוספות | 5–8 ימים |
| סיכון | גבוה (tools/delete) | נמוך | בינוני |
| **מומלץ אם** | צריך parity מלא עם Base44 | רוב המקרים | חסרות 3–5 פעולות ספציפיות |

### 6.7 צ'קליסט נוסף לאימות M16 (מעבר ל־§3 ה)

- [ ] `OwnerAssistantHome` → prompt מועבר לעוזר ונצרך (`initialPrompt` / `onPromptConsumed`)
- [ ] היסטוריה: פתיחת overlay, מעבר לשיחה ישנה, שיחה חדשה
- [ ] split: אחרי `MESSAGE_LIMIT` — סיכום + ארכוב (אם מיושם)
- [ ] קול: `MicButton` ממלא את שדה הקלט
- [ ] `ToolCallDisplay` / דיווח פעולה — רק אם runtime agents
- [ ] `zimmer_manager.jsonc` vendor מסונכרן עם whitelist בשרת (לא prompt בלבד)

### 6.8 קישורים

- מצב sync: [base44-sync-state.md](./base44-sync-state.md) (`last_seen_sha` יעודכן בסיום port)
- תוכנית port (לא M16): `.cursor/plans/base44_port_a9dba46_c5ed9337.plan.md`
- skill: `.cursor/skills/port-base44/mapping.md` — `OwnerAgentChat` ברשימת "never copy" (override = M16)
