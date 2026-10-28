/**
 * Assistant orchestrator — customer, owner panel (one brain, many surfaces), one-shot profiles.
 */
import { assertProfileAccess } from './profile-auth.js';
import { OWNER_PANEL_PROFILES, validateChatRequest } from './request-validator.js';
import { buildCustomerSearchContext } from './context-builder/customer-search.js';
import { buildCustomerSearchPrompt } from './prompt-builder/customer-search.js';
import { parseCustomerSearchResponse } from './response-parser/customer-search.js';
import {
  buildOwnerAssistantContext,
  resolveOwnerId,
} from './context-builder/owner-assistant.js';
import { buildOwnerAssistantPrompt } from './prompt-builder/owner-assistant.js';
import {
  finalizeOwnerAssistantContent,
  parseOwnerAssistantResponse,
} from './response-parser/owner-assistant.js';
import {
  confirmActionEffect,
  createPendingAction,
  handleOwnerActionDecision,
  isActionDecision,
  isBareConfirmMessage,
  operationAllowedByMode,
  rememberPendingForAdmin,
  takeLatestPendingActionId,
} from './owner-actions.js';
import { appendOwnerThreadTurns } from './owner-thread.js';
import {
  ONESHOT_PROFILES,
  handleOneshotProfile,
} from './oneshot-service.js';
import {
  OWNER_ONESHOT_PROFILES,
  handleOwnerOneshotProfile,
} from './owner-oneshot-service.js';
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
import { loadAttachmentParts } from '../llm/attachments.js';
import { OWNER_ASSISTANT_TOOLS } from './profiles.js';

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

  if (OWNER_PANEL_PROFILES.has(profile.id) && isActionDecision(req.clientState)) {
    assertStore(deps);
    return handleOwnerActionDecision(req, profile, actor, deps);
  }

  if (
    OWNER_PANEL_PROFILES.has(profile.id) &&
    isBareConfirmMessage(req.message) &&
    deps.store
  ) {
    const latestId = await takeLatestPendingActionId(deps.store, actor, req.clientState);
    if (latestId) {
      return handleOwnerActionDecision(
        {
          ...req,
          message: 'אישור',
          clientState: { ...(req.clientState || {}), confirmActionId: latestId },
        },
        profile,
        actor,
        deps,
      );
    }
  }

  if (CUSTOMER_PROFILES.has(profile.id)) {
    return handleCustomerProfile(req, profile, actor, deps);
  }

  if (profile.id === OWNER_ASSISTANT_PROFILE) {
    return handleOwnerAssistantProfile(req, profile, actor, deps);
  }

  if (OWNER_ONESHOT_PROFILES.has(profile.id)) {
    assertStore(deps);
    return handleOwnerOneshotProfile(req, profile, actor, deps);
  }

  if (ONESHOT_PROFILES.has(profile.id)) {
    return handleOneshotProfile(req, profile, actor, deps);
  }

  if (CREATOR_PROFILES.has(profile.id)) {
    return handleCreatorProfile(req, profile, actor, deps);
  }

  return handleStubProfile(req, profile, actor, deps);
}

function assertStore(deps) {
  if (!deps.store) {
    const err = new Error('Assistant service misconfigured: missing store');
    err.status = 500;
    err.code = 'INTERNAL';
    throw err;
  }
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
  assertStore(deps);
  const t0 = Date.now();

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

  const files = await loadAttachmentParts(req.attachments);
  let prompt = buildOwnerAssistantPrompt(ctx, req.message);
  if (files.length) {
    prompt += `\n\nהמשתמש צירף ${files.length} קבצים להודעה — התייחס לתוכנם בתשובה.`;
  }
  const llmStarted = Date.now();
  const llmRaw = await invokeLlm({
    prompt,
    tools: OWNER_ASSISTANT_TOOLS,
    files,
  });
  const llmMs = Date.now() - llmStarted;

  const parsed = parseOwnerAssistantResponse(llmRaw, { focus: ctx.focus });
  parsed.operation = operationAllowedByMode(req.clientState, parsed.operation);
  if (req.clientState?.mode === 'info') {
    parsed.uiEffects = [];
    parsed.actions = [];
    parsed.openForm = null;
  }
  if (parsed.parsed) parsed.parsed.operation = parsed.operation;
  const uiEffects = [...parsed.uiEffects];

  let pending = null;
  let incompleteOp = null;
  if (parsed.operation) {
    pending = createPendingAction(parsed.operation, ctx.zimmers, profile.id);
    if (pending) {
      uiEffects.push(confirmActionEffect(pending));
      rememberPendingForAdmin(pending, ownerId, actor);
    } else {
      incompleteOp = parsed.operation;
    }
  }

  const content = finalizeOwnerAssistantContent(parsed.content, {
    hasPendingAction: Boolean(pending),
    incompleteOperation: incompleteOp,
    zimmers: ctx.zimmers,
  });

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: pending ? `propose_${pending.op.type}` : 'chat_turn',
    summary: req.message,
  }).catch(() => {});

  const focusZimmerId = ctx.focus?.zimmerId || null;
  const ui = {};
  if (parsed.actions?.length) ui.actions = parsed.actions;
  if (parsed.openForm) ui.open_form = parsed.openForm;
  const threadStarted = Date.now();
  await appendOwnerThreadTurns(deps.store, ownerId, actor, [
    { role: 'user', content: req.message, surface: ctx.surface, zimmerId: focusZimmerId },
    {
      role: 'bot',
      content,
      surface: ctx.surface,
      zimmerId: focusZimmerId,
      ui: Object.keys(ui).length ? ui : null,
      pendingAction: pending,
    },
  ]).catch(() => {});
  const threadWriteMs = Date.now() - threadStarted;

  return {
    conversationId: null,
    message: {
      role: 'assistant',
      content,
      time: new Date().toISOString(),
    },
    uiEffects,
    executedActions: [],
    meta: {
      profile: profile.id,
      phase: OWNER_PHASE,
      surface: ctx.surface,
      responseMode: profile.responseMode,
      parsed: parsed.parsed,
      timing: {
        totalMs: Date.now() - t0,
        contextMs: ctx.timing?.contextMs,
        fetchMs: ctx.timing?.fetchMs,
        promptChars: typeof prompt === 'string' ? prompt.length : undefined,
        snapshotChars: ctx.timing?.promptChars,
        llmMs,
        llmModel: llmRaw?.model,
        threadWriteMs,
        zimmerCount: ctx.timing?.zimmerCount,
        bookingCount: ctx.timing?.bookingCount,
      },
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
