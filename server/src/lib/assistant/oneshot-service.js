/**
 * One-shot assistant handler — Phase 7.
 */
import {
  buildAdminSessionSummaryContext,
  buildInfoSummaryContext,
  buildOwnerTipsContext,
  buildVacationAgentContext,
} from './context-builder/oneshot.js';
import {
  buildAdminSessionSummaryPrompt,
  buildInfoSummaryPrompt,
  buildOwnerTipsPrompt,
  buildVacationAgentPrompt,
} from './prompt-builder/oneshot.js';
import { appendOwnerActionLog } from './conversation-service.js';
import { invokeLlm } from '../llm/index.js';

export const ONESHOT_PROFILES = new Set([
  'owner_tips',
  'admin_session_summary',
  'generate_info_summary',
  'vacation_agent',
]);

const PHASE = 7;

function textContent(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw.message === 'string') return raw.message.trim();
  if (raw && typeof raw.text === 'string') return raw.text.trim();
  return 'תשובת mock בעברית';
}

/**
 * @param {*} req
 * @param {*} profile
 * @param {import('../authz.js').Actor|null|undefined} actor
 * @param {{ user?: object|null, prisma?: import('@prisma/client').PrismaClient, store?: ReturnType<import('../entity-store.js').createEntityStore> }} deps
 */
export async function handleOneshotProfile(req, profile, actor, deps) {
  if (!deps.store) {
    const err = new Error('Assistant service misconfigured: missing store');
    err.status = 500;
    err.code = 'INTERNAL';
    throw err;
  }

  switch (profile.id) {
    case 'owner_tips':
      return handleOwnerTips(req, profile, actor, deps);
    case 'admin_session_summary':
      return handleAdminSessionSummary(req, profile, actor, deps);
    case 'generate_info_summary':
      return handleGenerateInfoSummary(req, profile, actor, deps);
    case 'vacation_agent':
      return handleVacationAgent(req, profile, actor, deps);
    default: {
      const err = new Error(`Unknown oneshot profile: ${profile.id}`);
      err.status = 400;
      throw err;
    }
  }
}

async function handleOwnerTips(req, profile, actor, deps) {
  const ctx = await buildOwnerTipsContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const prompt = buildOwnerTipsPrompt(ctx);
  const llmRaw = await invokeLlm({ prompt });
  const content = textContent(llmRaw);

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: 'owner_tips',
    summary: 'טיפים AI לדשבורד',
  }).catch(() => {});

  return buildOneshotResponse(profile, content, [], []);
}

async function handleAdminSessionSummary(req, profile, actor, deps) {
  const ctx = await buildAdminSessionSummaryContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const prompt = buildAdminSessionSummaryPrompt(ctx);
  const llmRaw = await invokeLlm({ prompt });
  const summary = textContent(llmRaw);

  await deps.store.update(
    'ChatSession',
    ctx.sessionId,
    { summary },
    actor,
  );

  const executedActions = [
    {
      type: 'update_session_summary',
      sessionId: ctx.sessionId,
      summary,
    },
  ];

  return buildOneshotResponse(profile, summary, [], executedActions);
}

async function handleGenerateInfoSummary(req, profile, actor, deps) {
  const ctx = await buildInfoSummaryContext(deps, {
    actor,
    clientState: req.clientState,
  });
  const prompt = buildInfoSummaryPrompt(ctx);
  const llmRaw = await invokeLlm({ prompt });
  const content = textContent(llmRaw);

  await appendOwnerActionLog(deps.store, actor, {
    profile: profile.id,
    actionType: 'generate_info_summary',
    summary: `סיכום מידע לצימר ${ctx.zimmer.name || ctx.zimmerId}`,
    entityType: 'Zimmer',
    entityId: ctx.zimmerId,
  }).catch(() => {});

  return buildOneshotResponse(profile, content, [], []);
}

async function handleVacationAgent(req, profile, actor, deps) {
  const ctx = await buildVacationAgentContext(deps, {
    actor,
    user: deps.user,
    clientState: req.clientState,
  });
  const prompt = buildVacationAgentPrompt(ctx, req.message);
  const llmRaw = await invokeLlm({
    prompt,
    add_context_from_internet: true,
  });
  const content = textContent(llmRaw);

  return buildOneshotResponse(profile, content, [], []);
}

function buildOneshotResponse(profile, content, uiEffects, executedActions) {
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
      phase: PHASE,
      responseMode: profile.responseMode,
    },
  };
}
