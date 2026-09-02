/**
 * Interactive creator/editor assistant handler — Phase 8.
 */
import {
  buildAdminZimmerEditorContext,
  buildOwnerBookingCreatorContext,
  buildOwnerZimmerCreatorContext,
  buildOwnerZimmerKnowledgeContext,
} from './context-builder/creator.js';
import {
  buildAdminZimmerEditorPrompt,
  buildOwnerBookingCreatorPrompt,
  buildOwnerZimmerCreatorPrompt,
  buildOwnerZimmerKnowledgePrompt,
} from './prompt-builder/creator.js';
import {
  parseAdminZimmerEditorResponse,
  parseOwnerBookingCreatorResponse,
  parseOwnerZimmerCreatorResponse,
} from './response-parser/creator.js';
import { appendOwnerActionLog } from './conversation-service.js';
import { invokeLlm } from '../llm/index.js';
import {
  ADMIN_ZIMMER_EDITOR_SCHEMA,
  BOOKING_CREATOR_SCHEMA,
  ZIMMER_CREATOR_SCHEMA,
} from './profiles.js';

export const CREATOR_PROFILES = new Set([
  'admin_zimmer_editor',
  'owner_booking_creator',
  'owner_zimmer_creator',
  'owner_zimmer_knowledge_summary',
]);

const PHASE = 8;

/**
 * @param {*} req
 * @param {*} profile
 * @param {import('../authz.js').Actor|null|undefined} actor
 * @param {{ user?: object|null, store?: ReturnType<import('../entity-store.js').createEntityStore> }} deps
 */
export async function handleCreatorProfile(req, profile, actor, deps) {
  if (!deps.store) {
    const err = new Error('Assistant service misconfigured: missing store');
    err.status = 500;
    err.code = 'INTERNAL';
    throw err;
  }

  switch (profile.id) {
    case 'admin_zimmer_editor':
      return handleAdminZimmerEditor(req, profile, actor, deps);
    case 'owner_booking_creator':
      return handleOwnerBookingCreator(req, profile, actor, deps);
    case 'owner_zimmer_creator':
      return handleOwnerZimmerCreator(req, profile, actor, deps);
    case 'owner_zimmer_knowledge_summary':
      return handleOwnerZimmerKnowledgeSummary(req, profile, actor, deps);
    default: {
      const err = new Error(`Unknown creator profile: ${profile.id}`);
      err.status = 400;
      throw err;
    }
  }
}

async function handleAdminZimmerEditor(req, profile, actor, deps) {
  const ctx = await buildAdminZimmerEditorContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const prompt = buildAdminZimmerEditorPrompt(ctx, req.message);
  const llmRaw = await invokeLlm({
    prompt,
    response_json_schema: ADMIN_ZIMMER_EDITOR_SCHEMA,
  });
  const parsed = parseAdminZimmerEditorResponse(llmRaw);

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: parsed.parsed.action,
    summary: req.message,
    entityType: 'Zimmer',
    entityId: ctx.zimmerId,
  }).catch(() => {});

  return buildCreatorResponse(profile, parsed);
}

async function handleOwnerBookingCreator(req, profile, actor, deps) {
  const ctx = await buildOwnerBookingCreatorContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const prompt = buildOwnerBookingCreatorPrompt(ctx, req.message);
  const llmRaw = await invokeLlm({
    prompt,
    response_json_schema: BOOKING_CREATOR_SCHEMA,
  });
  const parsed = parseOwnerBookingCreatorResponse(llmRaw);

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: parsed.parsed.action,
    summary: req.message,
  }).catch(() => {});

  return buildCreatorResponse(profile, parsed);
}

async function handleOwnerZimmerCreator(req, profile, actor, deps) {
  const ctx = await buildOwnerZimmerCreatorContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const prompt = buildOwnerZimmerCreatorPrompt(ctx, req.message);
  const llmRaw = await invokeLlm({
    prompt,
    response_json_schema: ZIMMER_CREATOR_SCHEMA,
  });
  const parsed = parseOwnerZimmerCreatorResponse(llmRaw);

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: parsed.parsed.action,
    summary: req.message,
  }).catch(() => {});

  return buildCreatorResponse(profile, parsed);
}

async function handleOwnerZimmerKnowledgeSummary(req, profile, actor, deps) {
  const ctx = await buildOwnerZimmerKnowledgeContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const prompt = buildOwnerZimmerKnowledgePrompt(ctx);
  const llmRaw = await invokeLlm({ prompt });
  const content =
    typeof llmRaw === 'string'
      ? llmRaw.trim()
      : pickText(llmRaw);

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: 'owner_zimmer_knowledge_summary',
    summary: `סיכום ידע לצימר ${ctx.zimmer.name || ctx.zimmerId}`,
    entityType: 'Zimmer',
    entityId: ctx.zimmerId,
  }).catch(() => {});

  return buildCreatorResponse(profile, {
    content,
    uiEffects: [],
    parsed: { summary: content },
  });
}

function pickText(raw) {
  if (typeof raw?.message === 'string') return raw.message.trim();
  if (typeof raw?.text === 'string') return raw.text.trim();
  return 'תשובת mock בעברית';
}

function buildCreatorResponse(profile, parsed) {
  return {
    conversationId: null,
    message: {
      role: 'assistant',
      content: parsed.content,
      time: new Date().toISOString(),
    },
    uiEffects: parsed.uiEffects || [],
    executedActions: [],
    meta: {
      profile: profile.id,
      phase: PHASE,
      responseMode: profile.responseMode,
      parsed: parsed.parsed,
    },
  };
}
