import KoaRouter from '@koa/router'
import { getMaterialChoiceStatuses, getCommittedChoices } from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rentalproperties/material-choice-statuses', async (ctx) => {
    const materialChoiceStatuses = await getMaterialChoiceStatuses('gryta')

    ctx.body = materialChoiceStatuses
  })

  router.get('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const materialChoices = await getCommittedChoices(ctx.params.id)

    ctx.body = materialChoices
  })
}


