/**
 * AI profile registry — mirrors current frontend InvokeLLM contracts.
 * Runtime source of truth for assistant API (Phase 2+).
 */

/** @typedef {'text'|'json'} ResponseMode */

/**
 * @typedef {object} AiProfileBaseline
 * @property {string} id
 * @property {string[]} sources
 * @property {ResponseMode} responseMode
 * @property {object|null} responseJsonSchema
 * @property {string[]} contractKeys — keys the frontend parser reads
 * @property {string[]} [actionValues] — known action/operation enum values
 * @property {string|null} mutationPath — how privileged writes happen today
 * @property {boolean} geminiSchemaStrict — true if toGeminiSchema succeeds
 */

/** Customer date-search subset schema (CustomerChat.handleDateSearch). */
export const CUSTOMER_DATE_SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string' },
    message: { type: 'string' },
    zimmer_ids: { type: 'array', items: { type: 'string' } },
  },
};

/** Customer chat send schema (CustomerChat.handleSend, SearchChat.handleSend). */
export const CUSTOMER_CHAT_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string' },
    message: { type: 'string' },
    zimmer_ids: { type: 'array', items: { type: 'string' } },
    zimmer_id: { type: 'string' },
    unanswered_question: { type: 'boolean' },
  },
};

/** OwnerInfoAssistant.runPrompt schema (simplified — fields nested in operation). */
export const OWNER_ASSISTANT_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    operation: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['create_zimmer', 'update_zimmer', 'create_booking'],
        },
        name: { type: 'string' },
        zimmer_id: { type: 'string' },
        fields: {
          type: 'object',
          properties: {
            price_per_night: { type: 'number' },
            description: { type: 'string' },
          },
        },
        guest_name: { type: 'string' },
        guest_phone: { type: 'string' },
        zimmer_name: { type: 'string' },
        check_in: { type: 'string' },
        check_out: { type: 'string' },
      },
      required: ['type'],
    },
    actions: { type: 'array', items: { type: 'string' } },
  },
};

export const ADMIN_ZIMMER_EDITOR_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string' },
    message: { type: 'string' },
    changes: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        location: { type: 'string' },
        price_per_night: { type: 'number' },
        num_rooms: { type: 'number' },
        max_guests: { type: 'number' },
        description: { type: 'string' },
        data_zones: { type: 'array', items: { type: 'object' } },
      },
    },
  },
};

export const BOOKING_CREATOR_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string' },
    message: { type: 'string' },
    booking: {
      type: 'object',
      properties: {
        guest_name: { type: 'string' },
        guest_phone: { type: 'string' },
        check_in: { type: 'string' },
        check_out: { type: 'string' },
        zimmer_name: { type: 'string' },
        num_guests: { type: 'number' },
        notes: { type: 'string' },
        status: { type: 'string', enum: ['ממתינה', 'אושרה'] },
      },
    },
  },
};

export const ZIMMER_CREATOR_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string' },
    message: { type: 'string' },
    zimmer_data: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        location: { type: 'string' },
        price_per_night: { type: 'number' },
        weekday_price: { type: 'number' },
        weekend_price: { type: 'number' },
        num_rooms: { type: 'number' },
        max_guests: { type: 'number' },
        description: { type: 'string' },
        data_zones: { type: 'array', items: { type: 'object' } },
      },
    },
  },
};

export const RECOMMENDATIONS_SCHEMA = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    restaurants: { type: 'array' },
    attractions: { type: 'array' },
    trails: { type: 'array' },
    nightlife: { type: 'array' },
    activities: { type: 'array' },
    interests_tags: { type: 'array', items: { type: 'string' } },
  },
};

/** Current invokeLlm mock output when response_json_schema is set. */
export const CURRENT_MOCK_SCHEMA_RESPONSE = {
  action: 'ask',
  message: 'תשובת mock בעברית',
  zimmer_ids: [],
};

export const CURRENT_MOCK_TEXT_RESPONSE = 'תשובת mock בעברית';

/** @type {AiProfileBaseline[]} */
export const AI_PROFILE_BASELINES = [
  {
    id: 'customer_date_search',
    sources: ['src/pages/CustomerChat.jsx', 'src/components/desktop/SearchChat.jsx'],
    responseMode: 'json',
    responseJsonSchema: CUSTOMER_DATE_SEARCH_SCHEMA,
    contractKeys: ['action', 'message', 'zimmer_ids'],
    actionValues: ['search', 'answer'],
    mutationPath: null,
    geminiSchemaStrict: true,
  },
  {
    id: 'customer_chat',
    sources: ['src/pages/CustomerChat.jsx', 'src/components/desktop/SearchChat.jsx'],
    responseMode: 'json',
    responseJsonSchema: CUSTOMER_CHAT_SCHEMA,
    contractKeys: ['action', 'message', 'zimmer_ids', 'zimmer_id', 'unanswered_question'],
    actionValues: ['search', 'answer', 'booking', 'view'],
    mutationPath: 'UnansweredQuestion.create (frontend) on unanswered_question',
    geminiSchemaStrict: true,
  },
  {
    id: 'vacation_agent',
    sources: ['src/components/chat/VacationAgentChat.jsx'],
    responseMode: 'text',
    responseJsonSchema: null,
    contractKeys: ['message'],
    actionValues: null,
    mutationPath: null,
    geminiSchemaStrict: false,
  },
  {
    id: 'owner_assistant',
    sources: ['src/components/owner/OwnerInfoAssistant.jsx'],
    responseMode: 'json',
    responseJsonSchema: OWNER_ASSISTANT_SCHEMA,
    contractKeys: ['message', 'operation', 'actions'],
    actionValues: ['create_zimmer', 'update_zimmer', 'create_booking'],
    mutationPath: 'executeOwnerAssistantOp (edit mode only)',
    geminiSchemaStrict: true,
  },
  {
    id: 'admin_zimmer_editor',
    sources: ['src/components/admin/AdminAssistantChat.jsx'],
    responseMode: 'json',
    responseJsonSchema: ADMIN_ZIMMER_EDITOR_SCHEMA,
    contractKeys: ['action', 'message', 'changes'],
    actionValues: ['clarify', 'update', 'confirm'],
    mutationPath: 'api.entities.Zimmer.update (frontend confirm)',
    geminiSchemaStrict: false,
  },
  {
    id: 'owner_booking_creator',
    sources: ['src/components/owner/BookingCreatorChat.jsx'],
    responseMode: 'json',
    responseJsonSchema: BOOKING_CREATOR_SCHEMA,
    contractKeys: ['action', 'message', 'booking'],
    actionValues: ['ask', 'create'],
    mutationPath: 'api.entities.BookingRequest.create (frontend confirm)',
    geminiSchemaStrict: true,
  },
  {
    id: 'owner_zimmer_creator',
    sources: ['src/components/admin/ZimmerCreatorChat.jsx'],
    responseMode: 'json',
    responseJsonSchema: ZIMMER_CREATOR_SCHEMA,
    contractKeys: ['action', 'message', 'zimmer_data'],
    actionValues: ['collect', 'build'],
    mutationPath: 'onSave → Zimmer.create (frontend confirm)',
    geminiSchemaStrict: false,
  },
  {
    id: 'owner_tips',
    sources: ['src/components/owner/OwnerDashboard.jsx'],
    responseMode: 'text',
    responseJsonSchema: null,
    contractKeys: [],
    actionValues: null,
    mutationPath: null,
    geminiSchemaStrict: false,
  },
  {
    id: 'admin_session_summary',
    sources: ['src/components/superadmin/ChatHistoryPanel.jsx'],
    responseMode: 'text',
    responseJsonSchema: null,
    contractKeys: [],
    actionValues: null,
    mutationPath: 'ChatSession.update summary field',
    geminiSchemaStrict: false,
  },
  {
    id: 'generate_info_summary',
    sources: ['src/components/admin/InfoSummaryEditor.jsx'],
    responseMode: 'text',
    responseJsonSchema: null,
    contractKeys: [],
    actionValues: null,
    mutationPath: null,
    geminiSchemaStrict: false,
  },
  {
    id: 'owner_zimmer_knowledge_summary',
    sources: ['src/components/owner/ZimmerDatabase.jsx'],
    responseMode: 'text',
    responseJsonSchema: null,
    contractKeys: ['summary'],
    actionValues: null,
    mutationPath: null,
    geminiSchemaStrict: false,
  },
  {
    id: 'stay_recommendations',
    sources: ['server/src/lib/generate-ai-recommendations.js'],
    responseMode: 'json',
    responseJsonSchema: RECOMMENDATIONS_SCHEMA,
    contractKeys: [
      'intro',
      'restaurants',
      'attractions',
      'trails',
      'nightlife',
      'activities',
      'interests_tags',
    ],
    actionValues: null,
    mutationPath: 'CustomerProfile.interests_tags update (server)',
    geminiSchemaStrict: false,
  },
];

export function getProfile(id) {
  return AI_PROFILE_BASELINES.find((p) => p.id === id) || null;
}
