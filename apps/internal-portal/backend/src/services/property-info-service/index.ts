import KoaRouter from '@koa/router'
import { getMaterialChoiceStatuses } from './adapters/core-adapter'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rentalproperties/material-choice-statuses', async (ctx) => {
    const materialChoiceStatuses = await getMaterialChoiceStatuses('gryta')

    ctx.body = materialChoiceStatuses
  })
}
