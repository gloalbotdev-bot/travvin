# מיפוי ארכיטקטורת AI — Travvin

> ניתוח קוד בלבד (ללא שינויים). תאריך: 2026-08-31

---

## 1. Executive Summary

מערכת ה-AI **אינה Agent עם tool-calling בצד השרת**. הארכיטקטורה בפועל:

**React (בונה prompt + history + context) → POST /api/ai/invoke-llm (ללא auth) → Gemini REST → JSON/text → React מפרש ומפעיל פעולות**

שלושה מסלולים עיקריים:
1. **InvokeLLM גנרי** — 13 call sites; prompts ב-frontend; שרת = proxy ל-Gemini
2. **Owner Assistant mutations** — LLM מחזיר `operation` JSON → `executeOwnerAssistantOp` (auth + whitelist)
3. **generateAIRecommendations** — prompt + LLM בשרת; cron בלבד; לא נקרא מה-UI

**אין:** OpenAI SDK, agent loop, executeTool, conversation API מאוחד.

---

## 2. End-to-End Flow

1. משתמש שולח הודעה ב-React (`CustomerChat`, `OwnerInfoAssistant`, וכו')
2. הקומפוננטה טוענת context דרך `api.entities.*`
3. בניית prompt בעברית (history, הנחיות, נתונים)
4. `api.integrations.Core.InvokeLLM(payload)` → `POST /api/ai/invoke-llm` (**auth: false**)
5. `invokeLlm()` → `invokeGemini()` → Google `generateContent`
6. תשובה: `{ result: string | object }`
7. Frontend מפרש `action` / `operation` / `changes`
8. פעולה: UI בלבד | `api.entities.*` | `executeOwnerAssistantOp`
9. DB: Prisma → PostgreSQL (`records` JSONB / `users`)

---

## 3. File Map

| Layer | File | Function | Purpose |
| ----- | ---- | -------- | ------- |
| UI | `src/pages/CustomerChat.jsx` | `handleSend` | בוט לקוח |
| UI | `src/components/owner/OwnerInfoAssistant.jsx` | `runPrompt`, `executeOperation` | עוזר בעלים |
| UI | `src/components/chat/VacationAgentChat.jsx` | `send` | סוכן נופש + Google Search |
| UI | `src/components/admin/AdminAssistantChat.jsx` | `handleSend`, `applyChanges` | עריכת צימר |
| UI | `src/components/owner/BookingCreatorChat.jsx` | `handleSend`, `handleSave` | יצירת הזמנה |
| UI | `src/components/admin/ZimmerCreatorChat.jsx` | `handleSend` | יצירת צימר |
| Client | `src/api/own/integrations.js` | `InvokeLLM()` | POST /api/ai/invoke-llm |
| Client | `src/api/own/functions.js` | `invoke()` | פונקציות מאומתות |
| Route | `server/src/routes/ai.js` | `createAiRouter()` | LLM endpoint |
| Route | `server/src/routes/functions.js` | `createFunctionsRouter()` | assistant ops + recommendations |
| LLM | `server/src/lib/llm/gemini.js` | `invokeGemini()` | Gemini REST |
| Business | `server/src/lib/owner-assistant-ops.js` | `executeOwnerAssistantOp()` | mutations מאובטחות |
| Business | `server/src/lib/generate-ai-recommendations.js` | `generateAIRecommendations()` | המלצות |
| Data | `server/src/lib/entity-store.js` | `create/update/filter` | data layer |
| Auth | `server/src/middleware/auth.js` | `requireAuth` | JWT |
| Auth | `server/src/lib/authz.js` | `assertCan()` | RLS |
| DB | `server/prisma/schema.prisma` | `Record`, `User` | PostgreSQL |

**אין Controller/Service/Repository נפרדים** — routes → lib → entity-store.

---

## 4. Request Flow

### InvokeLLM (כל הצ'אטים)

| שדה | ערך |
|-----|-----|
| Method | POST |
| URL | `/api/ai/invoke-llm` |
| Auth | **אין** (Content-Type: application/json בלבד) |
| Body | `{ prompt, response_json_schema?, add_context_from_internet?, model? }` |
| Response | `{ result: string \| object }` |

### דוגמת body (CustomerChat)

```json
{
  "prompt": "אתה בוט צימרים... [context + history + message]",
  "response_json_schema": {
    "type": "object",
    "properties": {
      "action": { "type": "string" },
      "message": { "type": "string" },
      "zimmer_ids": { "type": "array", "items": { "type": "string" } },
      "zimmer_id": { "type": "string" },
      "unanswered_question": { "type": "boolean" }
    }
  }
}
```

### executeOwnerAssistantOp (edit mode בלבד)

| שדה | ערך |
|-----|-----|
| Method | POST |
| URL | `/api/functions/executeOwnerAssistantOp` |
| Auth | Bearer JWT |
| Body | `{ owner_id, operation: { type, ...fields } }` |

**זיהוי משתמש ב-LLM:** לא נשלח ל-endpoint — מוטמע ב-prompt (client-side).

---

## 5. AI Flow

- **Provider:** Google Gemini REST (fetch, לא SDK)
- **Model default:** `gemini-3.5-flash` (env: `GEMINI_MODEL`)
- **Fallbacks:** `GEMINI_FALLBACK_MODELS`
- **System prompt בשרת:** רק ב-`generate-ai-recommendations.js`
- **כל שאר prompts:** ב-frontend
- **Tools:** רק `google_search` (VacationAgentChat) — לא app tools
- **Structured output:** JSON Schema → Gemini `responseSchema`
- **אין agent loop** — קריאה אחת לכל הודעה

---

## 6. Tools / Actions

לא tools רשומים בשרת — frontend מפרש JSON:

| Action | Parameters | Implementation | DB |
| ------ | ---------- | -------------- | -- |
| `search` | zimmer_ids | UI cards | לא |
| `answer` | message | טקסט | לא |
| `booking` | zimmer_id | booking form → create | כן |
| `unanswered_question` | zimmer_id | UnansweredQuestion.create | כן |
| `create_zimmer` | name, fields | executeOwnerAssistantOp | כן |
| `update_zimmer` | zimmer_id, fields | executeOwnerAssistantOp | כן |
| `create_booking` | guest, dates, zimmer_name | executeOwnerAssistantOp | כן |
| `actions[]` | calendar, bookings... | onNavigate (UI) | לא |
| admin `update` | changes | Zimmer.update ישירות | כן |
| booking chat `create` | booking | BookingRequest.create ישירות | כן |
| zimmer chat `build` | zimmer_data | onSave → create | כן |

---

## 7. Database Flow

```
Frontend action
  → /api/entities/*  OR  executeOwnerAssistantOp
    → entity-store.js
      → prisma.record.create/update/findMany
        → PostgreSQL (records JSONB)
```

- **ORM:** Prisma
- **Entities:** `Record` table + `entityType` + `data` JSONB
- **Users:** `users` table
- **Transactions:** רק BookingRequest.create (overlap lock)
- **RLS:** application layer (`authz.js` + JSON Schema per entity)

---

## 8. Authentication & Authorization

| Endpoint | Auth |
|----------|------|
| `/api/ai/invoke-llm` | **None** |
| `/api/entities/*` | Optional JWT → req.actor + RLS |
| `/api/functions/*` | requireAuth + role checks |

- **Actor:** `{ id, email, role }` — אין org/tenant
- **Scoping:** `owner_id` על records
- **executeOwnerAssistantOp:** actor.id === ownerId (או admin) + zimmer ownership
- **שני מסלולי mutation:** hardened (executeOwnerAssistantOp) vs direct entity writes (AdminAssistantChat, BookingCreatorChat)

---

## 9. Conversation State

| Chat | Persisted? | Where |
| ---- | ---------- | ----- |
| CustomerChat (logged in) | חלקי | ChatSession entity |
| CustomerChat (guest) | localStorage `cc_state_v1` | browser |
| OwnerInfoAssistant | **לא** | React state |
| VacationAgentChat | **לא** | React state |
| SearchChat | **לא** | in-memory |
| DirectChat | כן | DirectChat entity |

**ChatSession:** `messages[{role, content, time}]`, `summary`, `zimmer_ids_shown` — **אין** tool_calls/conversationId.

---

## 10. Existing External API

### POST /api/ai/invoke-llm
- **מתאים חלקית** — proxy ל-Gemini, stateless, ללא auth
- **לא מתאים** — אין conversation, אין tool execution, אין business logic

### POST /api/functions/executeOwnerAssistantOp
- דורש JWT + operation מובנה (לא NL)

### POST /api/functions/generateAIRecommendations
- use case ספציפי; auth required

**אין endpoint מאוחד** `POST /api/bot/chat`.

---

## 11. End-to-End Diagram

```
User
  → React (prompt + context + history)
    → POST /api/ai/invoke-llm (NO AUTH)
      → invokeLlm → invokeGemini
        → Google Gemini API
  ← { result: JSON }
  → React interpret action/operation
    → UI only
    → POST /api/functions/executeOwnerAssistantOp (JWT)
    → POST/PATCH /api/entities/* (JWT/guest)
      → entity-store → Prisma → PostgreSQL
```

---

## 12. Important Findings (לפני Bot Gateway)

1. Orchestration (prompt, history, dispatch) חי ב-**React**, לא בשרת
2. `/api/ai/invoke-llm` **פתוח לכולם** — סיכון עלות/שימוש לרעה
3. אין conversation API ל-owner/admin chats
4. אין multi-tenant — רק userId + role + owner_id
5. Base44 Agents הוסרו — OwnerInfoAssistant הוא התחלף
6. generateAIRecommendations קיים אך UI לא קורא אליו
7. אבטחת mutations לא אחידה (whitelist vs direct entity)

---

## 13. Unknowns

- Rate limiting על invoke-llm — לא בקוד
- Guest access ל-entities — תלוי RLS per entity (לא נותחו כולם)
- Production CORS/infra — תלוי env

---

## קבצי InvokeLLM (13 call sites)

| File | Use |
| ---- | --- |
| `CustomerChat.jsx` | בוט לקוח (2 calls) |
| `SearchChat.jsx` | desktop search (2) |
| `VacationAgentChat.jsx` | סוכן נופש |
| `OwnerInfoAssistant.jsx` | עוזר בעלים |
| `AdminAssistantChat.jsx` | עוזר ניהול |
| `BookingCreatorChat.jsx` | יצירת הזמנה |
| `ZimmerCreatorChat.jsx` | יצירת צימר |
| `OwnerDashboard.jsx` | טיפים |
| `ChatHistoryPanel.jsx` | סיכום שיחות |
| `InfoSummaryEditor.jsx` | info_summary |
| `ZimmerDatabase.jsx` | prompts ad-hoc |

---

## Env vars רלוונטיים (server)

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default: gemini-3.5-flash)
- `GEMINI_FALLBACK_MODELS`
- `LLM_MOCK=1` — mock responses
- `DATABASE_URL`, `DIRECT_URL`
