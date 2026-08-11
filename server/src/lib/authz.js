/**
 * Entity authorization — Base44 RLS + M15 tightenings.
 * Baseline: docs/migration/authz-baseline.md
 *
 * Intentionally permissive paths cite deferred-fixes registry numbers.
 */

import { getEntityMeta } from './schema-loader.js';

const ACTIONS = ['read', 'create', 'update', 'delete'];

/**
 * @typedef {{ id?: string|null, email?: string|null, role?: string|null }} Actor
 */

/**
 * @param {Partial<Actor>|null|undefined} raw
 * @returns {Actor}
 */
export function normalizeActor(raw) {
  if (!raw) return { id: null, email: null, role: null };
  return {
    id: raw.id || null,
    email: raw.email || null,
    role: raw.role || null,
  };
}

/**
 * @param {string} entityType
 * @param {'read'|'create'|'update'|'delete'} action
 * @param {Actor} actor
 * @param {object|null} [record]
 * @returns {boolean}
 */
export function can(entityType, action, actor, record = null) {
  if (!ACTIONS.includes(action)) return false;
  const user = normalizeActor(actor);
  const meta = getEntityMeta(entityType);
  const rls = meta.rls;

  if (!rls) {
    // Undeclared RLS → provisional open default (authz-baseline.md).
    // Remaining open entities cite deferred-fixes as needed.
    return true;
  }

  const rule = rls[action];
  if (rule === undefined) {
    return false;
  }

  return evalRule(rule, user, record);
}

/**
 * Filter a list of public records to those readable by actor.
 */
export function filterReadable(entityType, actor, records) {
  return records.filter((r) => can(entityType, 'read', actor, r));
}

/**
 * Prisma `where` fragment to scope list/filter reads.
 * Returns null = no extra restriction; false = match nothing.
 *
 * @returns {object|null|false}
 */
export function readScopeWhere(entityType, actor) {
  const user = normalizeActor(actor);
  const meta = getEntityMeta(entityType);
  const rls = meta.rls;

  if (!rls) {
    return null;
  }

  const rule = rls.read;
  if (rule && Object.keys(rule).length === 0) {
    // Empty read rule = open
    return null;
  }

  if (!rule) return false;

  return ruleToPrismaWhere(rule, user);
}

/**
 * @param {object} rule
 * @param {Actor} user
 * @param {object|null} record
 */
function evalRule(rule, user, record) {
  if (!rule || typeof rule !== 'object') return false;

  if (Object.keys(rule).length === 0) return true;

  if (rule.$or && Array.isArray(rule.$or)) {
    return rule.$or.some((branch) => evalRule(branch, user, record));
  }

  if (rule.$and && Array.isArray(rule.$and)) {
    return rule.$and.every((branch) => evalRule(branch, user, record));
  }

  if (rule.user_condition) {
    return matchUserCondition(rule.user_condition, user);
  }

  if (rule.target_user_ids_empty === true) {
    return isTargetUserIdsEmpty(record);
  }

  if (rule.target_user_ids_contains !== undefined) {
    const want = resolveTemplate(rule.target_user_ids_contains, user);
    if (want == null || want === '') return false;
    const ids = Array.isArray(record?.target_user_ids) ? record.target_user_ids : [];
    return ids.map(String).includes(String(want));
  }

  for (const [key, expected] of Object.entries(rule)) {
    if (
      key === '$or' ||
      key === '$and' ||
      key === 'user_condition' ||
      key === 'target_user_ids_empty' ||
      key === 'target_user_ids_contains'
    ) {
      continue;
    }
    if (!matchField(key, expected, user, record)) return false;
  }
  return Object.keys(rule).some(
    (k) =>
      k.startsWith('data.') ||
      k === 'created_by_id' ||
      k === 'user_condition' ||
      k === 'target_user_ids_empty' ||
      k === 'target_user_ids_contains',
  );
}

function isTargetUserIdsEmpty(record) {
  const ids = record?.target_user_ids;
  return !Array.isArray(ids) || ids.length === 0;
}

function matchUserCondition(cond, user) {
  if (!cond || typeof cond !== 'object') return false;
  for (const [k, v] of Object.entries(cond)) {
    if (k === 'role') {
      if (user.role !== v) return false;
      continue;
    }
    if (k === 'authenticated') {
      if (v === true && !user.id) return false;
      if (v === false && user.id) return false;
      continue;
    }
    if (user[k] !== v) return false;
  }
  return true;
}

function matchField(key, expected, user, record) {
  if (key === 'created_by_id') {
    const want = resolveTemplate(expected, user);
    if (want == null || want === '') return false;
    return String(record?.created_by_id ?? '') === String(want);
  }
  if (!key.startsWith('data.')) return false;
  const field = key.slice('data.'.length);
  const actual = record ? record[field] : undefined;
  const want = resolveTemplate(expected, user);
  if (want == null || want === '') return false;
  return String(actual) === String(want);
}

function resolveTemplate(value, user) {
  if (typeof value !== 'string') return value;
  if (value === '{{user.id}}') return user.id;
  if (value === '{{user.email}}') return user.email;
  if (value === '{{user.role}}') return user.role;
  return value.replace(/\{\{user\.(\w+)\}\}/g, (_, prop) => user[prop] ?? '');
}

/**
 * Translate a read rule into Prisma AND/OR.
 */
function ruleToPrismaWhere(rule, user) {
  if (!rule || typeof rule !== 'object') return false;
  if (Object.keys(rule).length === 0) return null;

  if (rule.$or) {
    const branches = rule.$or
      .map((b) => branchToWhere(b, user))
      .filter((b) => b !== false);
    if (branches.length === 0) return false;
    if (branches.some((b) => b === null)) return null;
    return { OR: branches };
  }

  if (rule.$and) {
    const parts = rule.$and
      .map((b) => branchToWhere(b, user))
      .filter((b) => b !== false);
    if (parts.length !== rule.$and.length) return false;
    if (parts.some((b) => b === null) && parts.every((b) => b === null)) return null;
    const concrete = parts.filter((b) => b !== null);
    if (concrete.length === 0) return null;
    if (concrete.length === 1) return concrete[0];
    return { AND: concrete };
  }

  return branchToWhere(rule, user);
}

function branchToWhere(branch, user) {
  if (!branch || typeof branch !== 'object') return false;

  if (branch.$or || branch.$and) {
    return ruleToPrismaWhere(branch, user);
  }

  if (branch.user_condition) {
    return matchUserCondition(branch.user_condition, user) ? null : false;
  }

  if (branch.target_user_ids_empty === true) {
    return { data: { path: ['target_user_ids'], equals: [] } };
  }

  if (branch.target_user_ids_contains !== undefined) {
    const want = resolveTemplate(branch.target_user_ids_contains, user);
    if (want == null || want === '') return false;
    return { data: { path: ['target_user_ids'], array_contains: [want] } };
  }

  const and = [];
  for (const [key, expected] of Object.entries(branch)) {
    if (
      key === 'user_condition' ||
      key === 'target_user_ids_empty' ||
      key === 'target_user_ids_contains' ||
      key === '$or' ||
      key === '$and'
    ) {
      continue;
    }
    if (key === 'created_by_id') {
      const want = resolveTemplate(expected, user);
      if (want == null || want === '') return false;
      and.push({ createdById: String(want) });
      continue;
    }
    if (!key.startsWith('data.')) continue;
    const field = key.slice('data.'.length);
    const want = resolveTemplate(expected, user);
    if (want == null || want === '') return false;
    and.push({ data: { path: [field], equals: want } });
  }

  if (and.length === 0) return false;
  if (and.length === 1) return and[0];
  return { AND: and };
}

/**
 * Throw 403 if not allowed.
 */
export function assertCan(entityType, action, actor, record = null) {
  if (!can(entityType, action, actor, record)) {
    const err = new Error(`Forbidden: ${action} on ${entityType}`);
    err.status = 403;
    throw err;
  }
}
