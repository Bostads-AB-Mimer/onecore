import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { LogsApi } from '../../adapters/keys-adapter'

export const routes = (router: KoaRouter) => {
  router.get('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const result = await LogsApi.list(page, limit)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  router.get('/logs/search', async (ctx) => {
    const metadata = generateRouteMetadata(ctx, [
      'q',
      'fields',
      'page',
      'limit',
    ])

    const result = await LogsApi.search(ctx.query)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { reason: 'Invalid search parameters', ...metadata }
        return
      }
      logger.error({ err: result.err, metadata }, 'Error searching logs')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  router.get('/logs/object/:objectId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await LogsApi.getByObjectId(ctx.params.objectId)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching logs for objectId'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/logs/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await LogsApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Log not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.post('/logs', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const payload = ctx.request.body

    const result = await LogsApi.create(payload)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request data', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating log')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/logs/rental-object/:rentalObjectCode', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const filters = {
      eventType: ctx.query.eventType as string | undefined,
      objectType: ctx.query.objectType as string | undefined,
      userName: ctx.query.userName as string | undefined,
    }

    const result = await LogsApi.getByRentalObjectCode(
      ctx.params.rentalObjectCode,
      page,
      limit,
      filters
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching logs for rental object'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })

  router.get('/logs/contact/:contactId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const page = ctx.query.page ? parseInt(ctx.query.page as string) : undefined
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const filters = {
      eventType: ctx.query.eventType as string | undefined,
      objectType: ctx.query.objectType as string | undefined,
      userName: ctx.query.userName as string | undefined,
    }

    const result = await LogsApi.getByContactId(
      ctx.params.contactId,
      page,
      limit,
      filters
    )

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching logs for contact'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { ...metadata, ...result.data }
  })
}
