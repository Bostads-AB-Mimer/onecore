import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db' 

const TABLE = 'logs'
const EVENT_TYPES = new Set(['update', 'creation', 'delete'])
const OBJECT_TYPES = new Set(['key_system', 'key', 'key_loan'])

export const routes = (router: KoaRouter) => {
  // LIST
  router.get('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE).select('*').orderBy('event_time', 'desc')
      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // GET by id
  router.get('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
      if (!row) { ctx.status = 404; ctx.body = { reason: 'Log not found', ...metadata }; return }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // CREATE
  router.post('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}
      if (typeof payload.event_type === 'string') payload.event_type = payload.event_type.toLowerCase()

      if (!payload.user_name || !EVENT_TYPES.has(payload.event_type) || !OBJECT_TYPES.has(payload.object_type)) {
        ctx.status = 400
        ctx.body = { error: 'Invalid or missing fields: user_name, event_type, object_type', ...metadata }
        return
      }

      const [row] = await db(TABLE).insert(payload).returning('*')
      ctx.status = 201
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error creating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // UPDATE partial
  router.patch('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload: any = ctx.request.body || {}
      if (typeof payload.event_type === 'string') payload.event_type = payload.event_type.toLowerCase()
      if (payload.event_type && !EVENT_TYPES.has(payload.event_type)) {
        ctx.status = 400; ctx.body = { error: 'Invalid event_type', ...metadata }; return
      }
      if (payload.object_type && !OBJECT_TYPES.has(payload.object_type)) {
        ctx.status = 400; ctx.body = { error: 'Invalid object_type', ...metadata }; return
      }

      const [row] = await db(TABLE).where({ id: ctx.params.id }).update(payload).returning('*')
      if (!row) { ctx.status = 404; ctx.body = { reason: 'Log not found', ...metadata }; return }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error updating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // DELETE
  router.delete('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const n = await db(TABLE).where({ id: ctx.params.id }).del()
      if (!n) { ctx.status = 404; ctx.body = { reason: 'Log not found', ...metadata }; return }
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, 'Error deleting log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
