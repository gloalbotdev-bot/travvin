/**
 * REST surface for Base44 entity contract + M4.5 authz.
 *
 *   GET    /api/entities/:entity
 *   GET    /api/entities/:entity/:id
 *   POST   /api/entities/:entity
 *   POST   /api/entities/:entity/filter
 *   PATCH  /api/entities/:entity/:id
 *   PUT    /api/entities/:entity/:id
 *   DELETE /api/entities/:entity/:id
 *
 * Undeclared-RLS entities stay intentionally open (authz-baseline.md,
 * deferred-fixes #1 #2 #18 #23). DirectChat / SystemMessage enforce jsonc RLS.
 */
import { Router } from 'express';
import { listEntityNames } from '../lib/schema-loader.js';
import { attachActor } from '../middleware/entity-authz.js';

/**
 * @param {ReturnType<import('../lib/entity-store.js').createEntityStore>} store
 */
export function createEntitiesRouter(store) {
  const router = Router();
  router.use(attachActor);

  router.get('/', (_req, res) => {
    res.json({ entities: listEntityNames() });
  });

  router.param('entity', (req, res, next, entity) => {
    try {
      store.getEntityMeta(entity);
      req.entityType = entity;
      next();
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/:entity', async (req, res) => {
    try {
      const { sort, limit } = req.query;
      const rows = await store.list(
        req.entityType,
        sort,
        limit != null ? Number(limit) : undefined,
        req.actor,
      );
      res.json(rows);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/:entity/filter', async (req, res) => {
    try {
      const body = req.body || {};
      let flat = body.query ?? body.filter ?? body;
      let sort = body.sort;
      let limit = body.limit;
      if (body.query == null && body.filter == null) {
        flat = { ...body };
        delete flat.sort;
        delete flat.limit;
      }
      const rows = await store.filter(
        req.entityType,
        flat,
        sort,
        limit,
        req.actor,
      );
      res.json(rows);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/:entity/:id', async (req, res) => {
    try {
      const row = await store.get(req.entityType, req.params.id, req.actor);
      res.json(row);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/:entity', async (req, res) => {
    try {
      const row = await store.create(req.entityType, req.body || {}, {
        actor: req.actor,
        createdById: req.actor?.id,
        createdBy: req.actor?.email,
      });
      res.status(201).json(row);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch('/:entity/:id', async (req, res) => {
    try {
      const row = await store.update(
        req.entityType,
        req.params.id,
        req.body || {},
        req.actor,
      );
      res.json(row);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put('/:entity/:id', async (req, res) => {
    try {
      const row = await store.update(
        req.entityType,
        req.params.id,
        req.body || {},
        req.actor,
      );
      res.json(row);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/:entity/:id', async (req, res) => {
    try {
      const result = await store.delete(
        req.entityType,
        req.params.id,
        req.actor,
      );
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

function sendError(res, err) {
  const status = err.status || 500;
  if (err.body) {
    res.status(status).json(err.body);
    return;
  }
  res.status(status).json({
    error: err.message || String(err),
    ...(err.details ? { details: err.details } : {}),
  });
}
