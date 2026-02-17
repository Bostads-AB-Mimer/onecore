import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { KeyEventsApi } from '../../adapters/keys-adapter'
import { createLogEntry } from './helpers'

export const routes = (router: KoaRouter) => {
  router.get('/key-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.list()

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error fetching key events')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/key-events/by-key/:keyId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const limit = ctx.query.limit
      ? parseInt(ctx.query.limit as string)
      : undefined

    const result = await KeyEventsApi.getByKey(ctx.params.keyId, limit)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata },
        'Error fetching key events by key'
      )
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.get('/key-events/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.get(ctx.params.id)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key event not found', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error fetching key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })

  router.post('/key-events', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.create(ctx.request.body)

    if (!result.ok) {
      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      if (result.err === 'conflict') {
        logger.error({ metadata }, 'Conflict creating key event')
        ctx.status = 409
        ctx.body = { error: 'Conflict creating key event', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error creating key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const keyEvent = result.data
    const requestKeys = ctx.request.body?.keys
    const keyCount = Array.isArray(requestKeys) ? requestKeys.length : 0

    const eventTypeLabel =
      keyEvent.type === 'FLEX'
        ? 'Flex'
        : keyEvent.type === 'ORDER'
          ? 'Extranyckel'
          : 'Bortappad'
    const description = `Skapad ${eventTypeLabel}-händelse för ${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}, status: ${keyEvent.status}`

    await createLogEntry(ctx, {
      eventType: 'creation',
      objectType: 'keyEvent',
      objectId: keyEvent.id,
      description,
    })

    ctx.status = 201
    ctx.body = { content: result.data, ...metadata }
  })

  router.put('/key-events/:id', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const result = await KeyEventsApi.update(ctx.params.id, ctx.request.body)

    if (!result.ok) {
      if (result.err === 'not-found') {
        ctx.status = 404
        ctx.body = { reason: 'Key event not found', ...metadata }
        return
      }

      if (result.err === 'bad-request') {
        ctx.status = 400
        ctx.body = { error: 'Invalid request body', ...metadata }
        return
      }

      logger.error({ err: result.err, metadata }, 'Error updating key event')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    const keyEvent = result.data
    const requestKeysForUpdate = ctx.request.body?.keys
    const keyCount = Array.isArray(requestKeysForUpdate)
      ? requestKeysForUpdate.length
      : 0

    const eventTypeLabel =
      keyEvent.type === 'FLEX'
        ? 'Flex'
        : keyEvent.type === 'ORDER'
          ? 'Extranyckel'
          : 'Bortappad'
    const statusLabel =
      keyEvent.status === 'ORDERED'
        ? 'Beställd'
        : keyEvent.status === 'RECEIVED'
          ? 'Inkommen'
          : 'Klar'
    const description = `Uppdaterat ${eventTypeLabel}-händelse (status: ${statusLabel}) för ${keyCount} ${keyCount === 1 ? 'nyckel' : 'nycklar'}`

    await createLogEntry(ctx, {
      eventType: 'update',
      objectType: 'keyEvent',
      objectId: ctx.params.id,
      description,
    })

    ctx.status = 200
    ctx.body = { content: result.data, ...metadata }
  })
}
