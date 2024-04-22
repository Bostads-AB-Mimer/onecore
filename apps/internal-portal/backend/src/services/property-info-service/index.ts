import KoaRouter from '@koa/router'
import {getMaterialChoices, getMaterialChoiceStatuses} from "./adapters/core-adapter";

export const routes = (router: KoaRouter) => {
  router.get('(.*)/rentalproperties/material-choice-statuses', async (ctx) => {
    const materialChoiceStatuses = await getMaterialChoiceStatuses('gryta')

    ctx.body = materialChoiceStatuses
  })

  router.get('(.*)/rentalproperties/:id/material-choices', async (ctx) => {
    const materialChoices = await getMaterialChoices(ctx.params.id)

    ctx.body = materialChoices
  })

  router.get('(.*)/rentalproperties/:apartmentId/:contractId/material-choices', async (ctx) => {
    const materialChoices = await getMaterialChoices(ctx.params.apartmentId, ctx.params.contractId)

    ctx.body = materialChoices
  })
}


