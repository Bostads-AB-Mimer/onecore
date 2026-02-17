import KoaRouter from '@koa/router'
import { generateRouteMetadata, logger } from '@onecore/utilities'
import { DaxApi } from '../../adapters/keys-adapter'
import { keys } from '@onecore/types'

export const routes = (router: KoaRouter) => {
  router.get('/dax/card-owners', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)

    const params: Partial<keys.QueryCardOwnersParams> = { ...ctx.query }
    if (params.offset) params.offset = parseInt(params.offset as any)
    if (params.limit) params.limit = parseInt(params.limit as any)

    const result = await DaxApi.searchCardOwners(params)

    if (!result.ok) {
      logger.error({ err: result.err, metadata }, 'Error searching card owners')
      ctx.status = 500
      ctx.body = { error: 'Internal server error', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { cardOwners: result.data, ...metadata }
  })

  router.get('/dax/card-owners/:cardOwnerId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { cardOwnerId } = ctx.params
    const expand = ctx.query.expand as string | undefined

    const result = await DaxApi.getCardOwner(cardOwnerId, expand)

    if (!result.ok) {
      logger.error(
        { err: result.err, metadata, cardOwnerId },
        'Error fetching card owner'
      )
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        error:
          result.err === 'not-found'
            ? 'Card owner not found'
            : 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { cardOwner: result.data, ...metadata }
  })

  router.get('/dax/cards/:cardId', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { cardId } = ctx.params
    const expand = ctx.query.expand as string | undefined

    const result = await DaxApi.getCard(cardId, expand)

    if (!result.ok) {
      logger.error({ err: result.err, metadata, cardId }, 'Error fetching card')
      ctx.status = result.err === 'not-found' ? 404 : 500
      ctx.body = {
        error:
          result.err === 'not-found'
            ? 'Card not found'
            : 'Internal server error',
        ...metadata,
      }
      return
    }

    ctx.status = 200
    ctx.body = { card: result.data, ...metadata }
  })
}
