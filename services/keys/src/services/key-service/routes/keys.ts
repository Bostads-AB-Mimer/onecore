import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { db } from '../adapters/db'

const TABLE = 'keys'

export const routes = (router: KoaRouter) => {
  // LIST
  router.get('(.*)/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const rows = await db(TABLE).select('*').orderBy('created_at', 'desc')
      ctx.status = 200
      ctx.body = { content: rows, ...metadata }
    } catch (err) {
      logger.error(err, 'Error listing keys')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // GET by id
  router.get('(.*)/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const row = await db(TABLE).where({ id: ctx.params.id }).first()
      if (!row) { ctx.status = 404; ctx.body = { reason: 'Key not found', ...metadata }; return }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error fetching key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // CREATE 
  router.post('(.*)/keys', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload = ctx.request.body || {}
      const [row] = await db(TABLE).insert(payload).returning('*')
      ctx.status = 201
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error creating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // UPDATE
  router.patch('(.*)/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const payload = ctx.request.body || {}
      const [row] = await db(TABLE)
        .where({ id: ctx.params.id })
        .update({ ...payload, updated_at: db.fn.now() })
        .returning('*')
      if (!row) { ctx.status = 404; ctx.body = { reason: 'Key not found', ...metadata }; return }
      ctx.status = 200
      ctx.body = { content: row, ...metadata }
    } catch (err) {
      logger.error(err, 'Error updating key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })

  // DELETE
  router.delete('(.*)/keys/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    try {
      const n = await db(TABLE).where({ id: ctx.params.id }).del()
      if (!n) { ctx.status = 404; ctx.body = { reason: 'Key not found', ...metadata }; return }
      ctx.status = 200
      ctx.body = { ...metadata }
    } catch (err) {
      logger.error(err, 'Error deleting key')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
    }
  })
}
