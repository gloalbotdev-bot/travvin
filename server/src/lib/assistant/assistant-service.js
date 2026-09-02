/**

 * Assistant orchestrator — Phase 7: customer, owner_assistant, one-shot profiles.

 */

import { assertProfileAccess } from './profile-auth.js';

import { validateChatRequest } from './request-validator.js';

import { buildCustomerSearchContext } from './context-builder/customer-search.js';

import { buildCustomerSearchPrompt } from './prompt-builder/customer-search.js';

import { parseCustomerSearchResponse } from './response-parser/customer-search.js';

import {

  buildOwnerAssistantContext,

  resolveOwnerId,

} from './context-builder/owner-assistant.js';

import { buildOwnerAssistantPrompt } from './prompt-builder/owner-assistant.js';

import { parseOwnerAssistantResponse } from './response-parser/owner-assistant.js';

import { dispatchOwnerAssistantOperation } from './action-dispatcher.js';

import {

  ONESHOT_PROFILES,

  handleOneshotProfile,

} from './oneshot-service.js';

import {

  CREATOR_PROFILES,

  handleCreatorProfile,

} from './creator-service.js';

import {

  appendOwnerActionLog,

  collectZimmerIdsFromResponse,

  mergeClientStateWithConversation,

  persistCustomerExchange,

  prepareCustomerConversation,

} from './conversation-service.js';

import { invokeLlm } from '../llm/index.js';



const CUSTOMER_PROFILES = new Set(['customer_date_search', 'customer_chat']);

const OWNER_ASSISTANT_PROFILE = 'owner_assistant';

const CUSTOMER_PHASE = 5;

const OWNER_PHASE = 6;



/**

 * @param {unknown} body

 * @param {import('../authz.js').Actor|null|undefined} actor

 * @param {{ user?: object|null, prisma?: import('@prisma/client').PrismaClient, store?: ReturnType<import('../entity-store.js').createEntityStore> }} [deps]

 */

export async function handleAssistantChat(body, actor, deps = {}) {

  const req = validateChatRequest(body);

  const profile = assertProfileAccess(actor, req.profile);



  if (CUSTOMER_PROFILES.has(profile.id)) {

    return handleCustomerProfile(req, profile, actor, deps);

  }



  if (profile.id === OWNER_ASSISTANT_PROFILE) {

    return handleOwnerAssistantProfile(req, profile, actor, deps);

  }



  if (ONESHOT_PROFILES.has(profile.id)) {

    return handleOneshotProfile(req, profile, actor, deps);

  }



  if (CREATOR_PROFILES.has(profile.id)) {

    return handleCreatorProfile(req, profile, actor, deps);

  }



  return handleStubProfile(req, profile, actor, deps);

}



async function handleCustomerProfile(req, profile, actor, deps) {

  if (!deps.prisma || !deps.store) {

    const err = new Error('Assistant service misconfigured: missing prisma/store');

    err.status = 500;

    err.code = 'INTERNAL';

    throw err;

  }



  const conversation = await prepareCustomerConversation(

    deps.store,

    actor,

    req.conversationId,

    profile.id,

  );



  const effectiveClientState = mergeClientStateWithConversation(

    req.clientState,

    conversation,

  );



  const ctx = await buildCustomerSearchContext(deps, {

    actor,

    profileId: profile.id,

    message: req.message,

    clientState: effectiveClientState,

  });



  if (profile.id === 'customer_date_search' && !ctx.searchParams) {

    const err = new Error('clientState.searchParams required for customer_date_search');

    err.status = 400;

    err.code = 'VALIDATION';

    throw err;

  }



  if (ctx.availableZimmers.length === 0 && (ctx.searchParams || req.clientState?.searchDates)) {

    const numGuests =

      ctx.searchParams?.numGuests ?? req.clientState?.searchDates?.numGuests ?? '';

    const emptyMsg =

      profile.id === 'customer_date_search'

        ? `😔 לא מצאתי צימרים פנויים לתאריכים האלו${numGuests ? ` עבור ${numGuests} אורחים` : ''}. נסה תאריכים אחרים!`

        : '😔 לא מצאתי צימרים פנויים. נסה תאריכים/אזור אחר.';



    const uiEffects = [{ type: 'date_search_widget' }];

    if (ctx.surface === 'desktop') {

      uiEffects.unshift(buildMapResultsEffect(ctx, req.clientState));

    }



    const conversationId = await persistCustomerExchange(deps.store, actor, deps.user, {

      conversationId: conversation.conversationId,

      sessionRow: conversation.sessionRow,

      profileId: profile.id,

      userMessage: req.message,

      assistantContent: emptyMsg,

      zimmerIds: [],

    });



    return {

      conversationId,

      message: {

        role: 'assistant',

        content: emptyMsg,

        time: new Date().toISOString(),

      },

      uiEffects,

      executedActions: [],

      meta: {

        profile: profile.id,

        phase: CUSTOMER_PHASE,

        emptyAvailability: true,

        responseMode: profile.responseMode,

      },

    };

  }



  const prompt = buildCustomerSearchPrompt(profile.id, ctx, req.message);

  const llmRaw = await invokeLlm({

    prompt,

    response_json_schema: profile.responseJsonSchema,

  });



  const parsed = parseCustomerSearchResponse(llmRaw, {

    availableZimmers: ctx.availableZimmers,

    surface: ctx.surface,

    searchDates: req.clientState?.searchDates || null,

  });



  const uiEffects = [...parsed.uiEffects];

  if (ctx.surface === 'desktop') {

    uiEffects.unshift(buildMapResultsEffect(ctx, req.clientState));

  }



  const zimmerIds = collectZimmerIdsFromResponse(uiEffects, parsed.parsed);



  const conversationId = await persistCustomerExchange(deps.store, actor, deps.user, {

    conversationId: conversation.conversationId,

    sessionRow: conversation.sessionRow,

    profileId: profile.id,

    userMessage: req.message,

    assistantContent: parsed.content,

    zimmerIds,

  });



  return {

    conversationId,

    message: {

      role: 'assistant',

      content: parsed.content,

      time: new Date().toISOString(),

    },

    uiEffects,

    executedActions: [],

    meta: {

      profile: profile.id,

      phase: CUSTOMER_PHASE,

      responseMode: profile.responseMode,

      parsed: parsed.parsed,

    },

  };

}



async function handleOwnerAssistantProfile(req, profile, actor, deps) {

  if (!deps.store) {

    const err = new Error('Assistant service misconfigured: missing store');

    err.status = 500;

    err.code = 'INTERNAL';

    throw err;

  }



  const ownerId = resolveOwnerId(actor, req.clientState);

  if (!ownerId) {

    const err = new Error('owner context required');

    err.status = 400;

    err.code = 'VALIDATION';

    throw err;

  }



  const ctx = await buildOwnerAssistantContext(deps, {

    actor,

    ownerId,

    message: req.message,

    clientState: req.clientState,

  });



  const prompt = buildOwnerAssistantPrompt(ctx, req.message);

  const llmRaw = await invokeLlm({

    prompt,

    response_json_schema: profile.responseJsonSchema,

  });



  const parsed = parseOwnerAssistantResponse(llmRaw, { mode: ctx.mode });

  const uiEffects = [...parsed.uiEffects];

  const executedActions = [];

  let content = parsed.content;



  if (ctx.mode === 'edit' && parsed.operation) {

    try {

      const dispatchResult = await dispatchOwnerAssistantOperation(deps.store, {

        operation: parsed.operation,

        ownerId,

        actor,

        ownerName: deps.user?.full_name || '',

        zimmers: ctx.zimmers,

      });

      content = dispatchResult.message || content;

      executedActions.push(dispatchResult);

      await appendOwnerActionLog(deps.store, actor, {

        profile: profile.id,

        actionType: dispatchResult.kind,

        summary: dispatchResult.message || req.message,

        entityType: dispatchResult.entityType,

        entityId: dispatchResult.entityId,

      }).catch(() => {});

    } catch (e) {

      content = e.message || '⚠️ לא הצלחתי לבצע את הפעולה.';

    }

  } else {

    await appendOwnerActionLog(deps.store, actor, {

      profile: profile.id,

      actionType: 'chat_turn',

      summary: req.message,

    }).catch(() => {});

  }



  return {

    conversationId: null,

    message: {

      role: 'assistant',

      content,

      time: new Date().toISOString(),

    },

    uiEffects,

    executedActions,

    meta: {

      profile: profile.id,

      phase: OWNER_PHASE,

      mode: ctx.mode,

      responseMode: profile.responseMode,

      parsed: parsed.parsed,

    },

  };

}



async function handleStubProfile(req, profile, actor, deps) {

  const response = buildStubResponse(profile, req);



  if (deps.store && actor?.id) {

    await appendOwnerActionLog(deps.store, actor, {

      profile: profile.id,

      actionType: 'chat_turn',

      summary: req.message,

    }).catch(() => {});

  }



  return response;

}



function buildMapResultsEffect(ctx, clientState) {

  const sd = clientState?.searchDates || ctx.searchParams || {};

  return {

    type: 'map_results',

    zimmerIds: ctx.availableZimmers.map((z) => z.id),

    checkIn: sd.checkIn || sd.rangeStart || ctx.priceCheckIn,

    checkOut: sd.checkOut || sd.rangeEnd || ctx.priceCheckOut,

    priceCheckIn: ctx.priceCheckIn,

    priceCheckOut: ctx.priceCheckOut,

    numAdults: ctx.numAdults,

    numChildren: ctx.numChildren,

  };

}



function buildStubResponse(profile, req) {

  return {

    conversationId: req.conversationId,

    message: {

      role: 'assistant',

      content: `[stub] התקבלה הודעה בפרופיל "${profile.id}". שלב 2 — פרופיל זה עדיין לא הועבר לשרת.`,

      time: new Date().toISOString(),

    },

    uiEffects: [],

    executedActions: [],

    meta: {

      profile: profile.id,

      phase: 2,

      stub: true,

      responseMode: profile.responseMode,

    },

  };

}


