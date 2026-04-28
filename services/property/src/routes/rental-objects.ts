import KoaRouter from '@koa/router'
import { generateRouteMetadata } from '@onecore/utilities'
import { getRentalObjectTypeByRentalId } from '@src/adapters/rental-object-adapter'

export const routes = (router: KoaRouter) => {
  router.get('/rental-objects/:rentalId/type', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const { rentalId } = ctx.params

    const result = await getRentalObjectTypeByRentalId(rentalId)

    if (!result) {
      ctx.status = 404
      ctx.body = { error: 'Rental object not found', ...metadata }
      return
    }

    ctx.status = 200
    ctx.body = { content: result, ...metadata }
  })
}
