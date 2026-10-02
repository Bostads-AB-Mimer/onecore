import KoaRouter from '@koa/router'
import { HealthCheckTarget, pollSystemHealth } from '@onecore/utilities'
import { AppContext } from '@src/context'

export const routes = (router: KoaRouter, { config, modules }: AppContext) => {
  const subsystems: HealthCheckTarget[] = [
    { probe: () => modules.coreClient.health() },
  ]

  router.get(`${config.routePrefix}/health`, async (ctx) => {
    ctx.body = await pollSystemHealth(config.applicationName, subsystems)
  })
}
