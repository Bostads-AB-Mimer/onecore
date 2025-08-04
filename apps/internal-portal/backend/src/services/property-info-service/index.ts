import KoaRouter from '@koa/router'
import {
  getMaterialChoices,
  getMaterialChoiceStatuses,
} from './adapters/core-adapter'
import { generateRouteMetadata } from 'onecore-utilities'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rentalproperties/material-choice-statuses', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const materialChoiceStatuses = await getMaterialChoiceStatuses('gryta')

    ctx.body = { content: materialChoiceStatuses, ...metadata }
  })

  router.get('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const metadata = generateRouteMetadata(ctx)
    const materialChoices = await getMaterialChoices(ctx.params.id)

    ctx.body = { content: materialChoices, ...metadata }
  })

  router.get(
    '(.*)/rentalproperties/:apartmentId/:contractId/material-choices',
    async (ctx) => {
      const metadata = generateRouteMetadata(ctx)
      const materialChoices = await getMaterialChoices(
        ctx.params.apartmentId,
        ctx.params.contractId
      )

      ctx.body = { content: materialChoices, ...metadata }
    }
  )
}
