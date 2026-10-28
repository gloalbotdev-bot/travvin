/**
 * Interactive creator/editor assistant handler — Phase 8.
 * Owner wizards share the owner base prompt + thread memory; a finished wizard
 * proposes a pending action (confirm_action) instead of a client-side save.
 * Admin sessions have no thread and keep the legacy client save.
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
  buildOwnerZimmerKnowledgePrompt,
} from './prompt-builder/creator.js';
import {
  parseAdminZimmerEditorResponse,
  parseOwnerBookingCreatorResponse,
  parseOwnerZimmerCreatorResponse,
} from './response-parser/creator.js';
import { appendOwnerActionLog } from './conversation-service.js';
import { buildOwnerBaseContext } from './context-builder/owner-base.js';
import { buildOwnerAssistantContext, resolveOwnerId } from './context-builder/owner-assistant.js';
import { buildOwnerBasePrompt } from './prompt-builder/owner-base.js';
import { buildOwnerAssistantPrompt } from './prompt-builder/owner-assistant.js';
import {
  finalizeOwnerAssistantContent,
  parseOwnerAssistantResponse,
} from './response-parser/owner-assistant.js';
import { appendOwnerThreadTurns, threadWritable } from './owner-thread.js';
import { confirmActionEffect, createPendingAction, operationAllowedByMode } from './owner-actions.js';
import { findDuplicateZimmerName, isActionableOperation } from '../owner-assistant-ops.js';
import { invokeLlm } from '../llm/index.js';
import { OWNER_ASSISTANT_TOOLS, ADMIN_ZIMMER_EDITOR_SCHEMA, BOOKING_CREATOR_SCHEMA } from './profiles.js';

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

/** Shared owner base (identity, data, cross-bubble memory) for a wizard surface. */
async function ownerBasePrefix(deps, actor, ownerId, message, surface, focus = null) {
  if (!ownerId) return { base: null, prefix: '' };
  const base = await buildOwnerBaseContext(deps, { actor, ownerId, message, focus });
  return { base, prefix: buildOwnerBasePrompt(base, { surface }) };
}

/**
 * Write the wizard turn to the owner's thread; attach a pending action when the wizard is done.
 * @returns {Promise<object[]>} extra uiEffects
 */
async function finishWizardTurn(deps, actor, ownerId, { surface, zimmerId, userMessage, botMessage, op, zimmers, profileId }) {
  const uiEffects = [];
  let pending = null;
  if (op && threadWritable(actor, ownerId)) {
    pending = createPendingAction(op, zimmers, profileId);
    if (pending) uiEffects.push(confirmActionEffect(pending));
  }
  await appendOwnerThreadTurns(deps.store, ownerId, actor, [
    { role: 'user', content: userMessage, surface, zimmerId },
    { role: 'bot', content: botMessage, surface, zimmerId, pendingAction: pending },
  ]).catch(() => {});
  return uiEffects;
}

async function handleAdminZimmerEditor(req, profile, actor, deps) {
  const ctx = await buildAdminZimmerEditorContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const ownerId = String(ctx.zimmer.owner_id || '');
  const { prefix } = await ownerBasePrefix(deps, actor, ownerId, req.message, 'zimmer_editor', {
    zimmerId: ctx.zimmerId,
  });
  const prompt = `${prefix}\n${buildAdminZimmerEditorPrompt(ctx, req.message)}`;
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

  const changes = parsed.parsed.changes;
  const extraEffects = await finishWizardTurn(deps, actor, ownerId, {
    surface: 'zimmer_editor',
    zimmerId: ctx.zimmerId,
    userMessage: req.message,
    botMessage: parsed.content,
    op: (parsed.parsed.action === 'update' || parsed.parsed.action === 'confirm') && changes
      ? { type: 'update_zimmer', zimmer_id: ctx.zimmerId, fields: changes }
      : null,
    zimmers: [ctx.zimmer],
    profileId: profile.id,
  });

  return buildCreatorResponse(profile, { ...parsed, uiEffects: [...parsed.uiEffects, ...extraEffects] });
}

async function handleOwnerBookingCreator(req, profile, actor, deps) {
  const ctx = await buildOwnerBookingCreatorContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const { prefix } = await ownerBasePrefix(deps, actor, ctx.ownerId, req.message, 'booking_creator');
  const prompt = `${prefix}\n${buildOwnerBookingCreatorPrompt(ctx, req.message)}`;
  const llmRaw = await invokeLlm({
    prompt,
    response_json_schema: BOOKING_CREATOR_SCHEMA,
  });
  const parsed = parseOwnerBookingCreatorResponse(llmRaw, { collectedData: ctx.collectedData });

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: parsed.parsed.action,
    summary: req.message,
  }).catch(() => {});

  const b = parsed.parsed.booking;
  const extraEffects = await finishWizardTurn(deps, actor, ctx.ownerId, {
    surface: 'booking_creator',
    userMessage: req.message,
    botMessage: parsed.content,
    op: parsed.parsed.action === 'create' && b
      ? {
          type: 'create_booking',
          guest_name: b.guest_name,
          guest_phone: b.guest_phone,
          zimmer_name: b.zimmer_name,
          check_in: b.check_in,
          check_out: b.check_out,
          num_guests: b.num_guests,
          notes: b.notes || '',
          status: b.status,
          ...(b.price_override != null && Number(b.price_override) > 0
            ? { price_override: b.price_override }
            : {}),
        }
      : null,
    zimmers: ctx.zimmers,
    profileId: profile.id,
  });

  return buildCreatorResponse(profile, { ...parsed, uiEffects: [...parsed.uiEffects, ...extraEffects] });
}

function wizardDataParagraph(wizard) {
  const raw = typeof wizard.conversationDataStr === 'string' ? wizard.conversationDataStr : '{}';
  const collected = raw.length > 6000 ? `${raw.slice(0, 6000)}…` : raw;
  const beds = wizard.customBedTypes?.length
    ? wizard.customBedTypes
        .map((t) => `${t.custom_label}${t.sleeps ? ` (${t.sleeps} ישנים)` : ''}`)
        .join(', ')
    : 'אין';
  return `
נתוני המסך צימר חדש:
מה שכבר נאסף: ${collected}
תמונות שהועלו: ${wizard.uploadedImageCount || 0}
סוגי מיטה שהבעל כבר הגדיר: ${beds}`;
}

function zimmerDataFromOperation(op) {
  if (!op || op.type !== 'create_zimmer') return null;
  const { type: _type, ...fields } = op;
  return parseOwnerZimmerCreatorResponse({
    action: 'build',
    message: 'הצעה',
    zimmer_data: fields,
  }).parsed.zimmer_data;
}

async function handleOwnerZimmerCreator(req, profile, actor, deps) {
  const ownerId = resolveOwnerId(actor, req.clientState);
  if (!ownerId) {
    const err = new Error('owner context required');
    err.status = 400;
    err.code = 'VALIDATION';
    throw err;
  }
  const wizard = await buildOwnerZimmerCreatorContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const ctx = await buildOwnerAssistantContext(deps, {
    actor,
    ownerId,
    message: req.message,
    clientState: { ...(req.clientState || {}), surface: 'zimmer_creator' },
  });
  const prompt = `${buildOwnerAssistantPrompt(ctx, req.message)}${wizardDataParagraph(wizard)}`;
  const llmRaw = await invokeLlm({
    prompt,
    tools: OWNER_ASSISTANT_TOOLS,
  });
  const parsed = parseOwnerAssistantResponse(llmRaw, { focus: ctx.focus });
  parsed.operation = operationAllowedByMode(req.clientState, parsed.operation);
  if (req.clientState?.mode === 'info') {
    parsed.uiEffects = [];
    parsed.actions = [];
    parsed.openForm = null;
  }

  const isCreate = parsed.operation?.type === 'create_zimmer';
  const mergedOp = isCreate
    ? {
        ...(wizard.conversationData || {}),
        ...parsed.operation,
        type: 'create_zimmer',
        name: parsed.operation.name || wizard.conversationData?.name,
      }
    : parsed.operation;
  const zimmerData = isCreate ? zimmerDataFromOperation(mergedOp) : null;
  const duplicateCreate =
    isCreate && Boolean(findDuplicateZimmerName(mergedOp?.name, ctx.zimmers || []));
  const willCard =
    Boolean(mergedOp) &&
    isActionableOperation(mergedOp) &&
    !duplicateCreate &&
    threadWritable(actor, ownerId);
  const canPreview = Boolean(zimmerData?.name) && (willCard || !threadWritable(actor, ownerId));
  const content = finalizeOwnerAssistantContent(parsed.content, {
    hasPendingAction: willCard,
    incompleteOperation: (isCreate && !canPreview) || duplicateCreate ? mergedOp : null,
    zimmers: ctx.zimmers,
  });

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: canPreview ? 'build' : 'collect',
    summary: req.message,
  }).catch(() => {});

  const extraEffects = await finishWizardTurn(deps, actor, ownerId, {
    surface: 'zimmer_creator',
    userMessage: req.message,
    botMessage: content,
    op: willCard ? mergedOp : null,
    zimmers: ctx.zimmers || [],
    profileId: profile.id,
  });
  const action = canPreview ? 'build' : 'collect';
  const shownData = canPreview ? zimmerData : null;
  const uiEffects = [...parsed.uiEffects];
  if (canPreview) uiEffects.push({ type: 'zimmer_preview', zimmerData: shownData });

  return buildCreatorResponse(profile, {
    content,
    uiEffects: [...uiEffects, ...extraEffects],
    parsed: { action, message: content, zimmer_data: shownData },
  });
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
