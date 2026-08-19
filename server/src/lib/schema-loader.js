/**
 * Loads entity JSON Schema (+ RLS blocks) from server/src/schemas/*.jsonc.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Canonical schemas dir (copied from legacy entities in M14). */
function resolveEntitiesDir() {
  const dir = path.resolve(__dirname, '../schemas');
  if (fs.existsSync(dir)) return dir;
  throw new Error(`Entity schemas not found at ${dir}`);
}

/** Minimal JSONC → JSON (strip line/block comments; trailing commas). */
function parseJsonc(raw) {
  let s = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/^\s*\/\/.*$/gm, '');
  s = s.replace(/,\s*([\]}])/g, '$1');
  return JSON.parse(s);
}

const ENTITY_NAMES = [
  'AdminPermission',
  'AppSetting',
  'BookingRequest',
  'ChatSession',
  'Contact',
  'CustomerProfile',
  'DirectChat',
  'GuestMessage',
  'OwnerRequest',
  'Promotion',
  'Review',
  'SupplierAutomation',
  'SupplierMessage',
  'SyncState',
  'SystemMessage',
  'UnansweredQuestion',
  'User',
  'Zimmer',
];

/** Auto fields managed by the store — not validated as schema properties. */
export const AUTO_FIELDS = new Set([
  'id',
  'created_date',
  'updated_date',
  'created_by_id',
  'created_by',
]);

let cache = null;
let cacheMtime = 0;

function schemasDirMtime() {
  const dir = resolveEntitiesDir();
  let max = 0;
  for (const name of ENTITY_NAMES) {
    const filePath = path.join(dir, `${name}.jsonc`);
    if (fs.existsSync(filePath)) {
      max = Math.max(max, fs.statSync(filePath).mtimeMs);
    }
  }
  return max;
}

function loadAll() {
  const mtime = schemasDirMtime();
  if (cache && mtime <= cacheMtime) return cache;
  const dir = resolveEntitiesDir();
  const byName = new Map();

  for (const name of ENTITY_NAMES) {
    const filePath = path.join(dir, `${name}.jsonc`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing entity schema: ${filePath}`);
    }
    const schema = parseJsonc(fs.readFileSync(filePath, 'utf8'));
    byName.set(name, {
      name,
      schema,
      properties: schema.properties || {},
      required: schema.required || [],
      rls: schema.rls || null,
      defaults: extractDefaults(schema.properties || {}),
    });
  }

  cache = { byName, names: [...ENTITY_NAMES] };
  cacheMtime = mtime;
  return cache;
}

function extractDefaults(properties) {
  const out = {};
  for (const [key, def] of Object.entries(properties)) {
    if (def && Object.prototype.hasOwnProperty.call(def, 'default')) {
      out[key] = structuredClone(def.default);
    }
  }
  return out;
}

export function listEntityNames() {
  return loadAll().names;
}

export function getEntityMeta(entityName) {
  const meta = loadAll().byName.get(entityName);
  if (!meta) {
    const err = new Error(`Unknown entity: ${entityName}`);
    err.status = 404;
    throw err;
  }
  return meta;
}

export function isKnownEntity(entityName) {
  return loadAll().byName.has(entityName);
}

/**
 * Apply schema-declared defaults for missing keys only.
 */
export function applyDefaults(entityName, data) {
  const { defaults } = getEntityMeta(entityName);
  const result = { ...data };
  for (const [key, value] of Object.entries(defaults)) {
    if (result[key] === undefined) {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

/**
 * Zod validator reflecting schema declarations (M15 #13: min/max, format).
 */
export function buildValidator(entityName, { partial = false } = {}) {
  const { properties, required } = getEntityMeta(entityName);
  const shape = {};

  for (const [key, prop] of Object.entries(properties)) {
    shape[key] = propToZod(prop).optional();
  }

  let schema = z.object(shape).passthrough();

  if (!partial && required.length > 0) {
    schema = schema.superRefine((val, ctx) => {
      for (const key of required) {
        if (val[key] === undefined || val[key] === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Missing required field: ${key}`,
            path: [key],
          });
        }
      }
    });
  }

  return schema;
}

function propToZod(prop) {
  // UI forms often send `null` to clear optional fields (e.g. ZimmerEditor).
  // JSON Schema here does not declare ["number","null"], but rejecting null blocks saves.
  return propToZodInner(prop).nullable();
}

const DATE_STRING = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

function propToZodInner(prop) {
  if (!prop || typeof prop !== 'object') return z.any();

  if (Array.isArray(prop.type)) {
    // uncommon; treat as any
    return z.any();
  }

  switch (prop.type) {
    case 'string': {
      if (prop.enum) return z.enum(prop.enum);
      if (prop.format === 'date') return DATE_STRING;
      if (prop.format === 'email') return z.string().email();
      return z.string();
    }
    case 'number':
    case 'integer': {
      let n = z.number();
      if (prop.minimum != null) n = n.min(prop.minimum);
      if (prop.maximum != null) n = n.max(prop.maximum);
      return n;
    }
    case 'boolean':
      return z.boolean();
    case 'array': {
      if (prop.items) {
        return z.array(propToZod(prop.items));
      }
      return z.array(z.any());
    }
    case 'object': {
      if (prop.properties) {
        const nested = {};
        for (const [k, v] of Object.entries(prop.properties)) {
          nested[k] = propToZod(v).optional();
        }
        return z.object(nested).passthrough();
      }
      return z.record(z.any());
    }
    default:
      return z.any();
  }
}

export function stripAutoFields(data) {
  const out = { ...data };
  for (const key of AUTO_FIELDS) {
    delete out[key];
  }
  return out;
}

export function validatePayload(entityName, data, { partial = false } = {}) {
  const cleaned = stripAutoFields(data);
  const validator = buildValidator(entityName, { partial });
  const parsed = validator.safeParse(cleaned);
  if (!parsed.success) {
    const err = new Error(parsed.error.issues.map((i) => i.message).join('; '));
    err.status = 400;
    err.details = parsed.error.issues;
    throw err;
  }
  return parsed.data;
}
