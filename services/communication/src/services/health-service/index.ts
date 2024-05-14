import KoaRouter from '@koa/router'
import { SystemHealth, SystemStatus } from 'onecore-types'

export const routes = (router: KoaRouter) => {
  router.get('(.*)/health', async (ctx) => {
    const currentSystemStatus: SystemStatus = 'active'
    const currentSystemStatusMessage = ''

    const health: SystemHealth = {
      name: 'communication',
      status: 'active',
    }

    health.status = currentSystemStatus
    health.statusMessage = currentSystemStatusMessage

    ctx.body = health
  })
}
