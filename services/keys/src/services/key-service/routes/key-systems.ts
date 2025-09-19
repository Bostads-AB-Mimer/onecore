import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'

const TABLE = 'key_systems'
const ALLOWED_TYPES = new Set(['MECHANICAL', 'ELECTRONIC', 'HYBRID'])

export const routes = (router: KoaRouter) => {
  // LIST
  router.get('/key-systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE).select('*').orderBy('created_at', 'desc')
      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing key systems')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // GET by id
  router.get('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // CREATE
  router.post('/key-systems', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}

      // Validate type
      if (typeof payload.type === 'string') {
        payload.type = payload.type.toUpperCase()
      }
      if (payload.type && !ALLOWED_TYPES.has(payload.type)) {
        ctx.status = 400
        ctx.body = { error: 'Invalid type', ...metadata }
        return
      }

      // Check for duplicate system_code
      if (payload.system_code) {
        const existing = await db(TABLE)
          .where({ system_code: payload.system_code })
          .first()
        if (existing) {
          ctx.status = 409
          ctx.body = { error: 'Key system with this system code already exists', ...metadata }
          return
        }
      }

      const [row] = await db(TABLE).insert(payload).returning('*')
      ctx.status = 201
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error creating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // UPDATE (partial)
  router.patch('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}

      // Validate type
      if (typeof payload.type === 'string') {
        payload.type = payload.type.toUpperCase()
      }
      if (payload.type && !ALLOWED_TYPES.has(payload.type)) {
        ctx.status = 400
        ctx.body = { error: 'Invalid type', ...metadata }
        return
      }

      // Check for duplicate system_code if being updated
      if (payload.system_code) {
        const existing = await db(TABLE)
          .where({ system_code: payload.system_code })
          .whereNot({ id: ctx.params.id })
          .first()
        if (existing) {
          ctx.status = 409
          ctx.body = { error: 'Key system with this system code already exists', ...metadata }
          return
        }
      }

      const [row] = await db(TABLE)
        .where({ id: ctx.params.id })
        .update({ ...payload, updated_at: db.fn.now() })
        .returning('*')

      if (!row) {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }

      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error updating key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // DELETE
  router.delete('/key-systems/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const n = await db(TABLE).where({ id: ctx.params.id }).del()
      if (!n) {
        ctx.status = 404
        ctx.body = { reason: 'Key system not found', ...metadata }
        return
      }
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, 'Error deleting key system')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}