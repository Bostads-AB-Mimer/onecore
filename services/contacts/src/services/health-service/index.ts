import {
  DbResource,
  collectDbPoolMetrics,
  HealthCheckTarget,
  SystemHealth,
  pollSystemHealth,
  probeResource,
} from '@onecore/utilities'

import { OkapiRouter } from 'koa-okapi-router'
import { AppInfrastructure } from '@src/context'

const healthChecks: Map<string, SystemHealth> = new Map()

export const routes = (router: OkapiRouter, infra: AppInfrastructure) => {
  const { xpandDb, contactsDb } = infra

  /**
   * Round-up of DB connections used by this service
   */
  const CONNECTIONS: DbResource[] = [xpandDb, contactsDb]

  const subsystems: HealthCheckTarget[] = [
    {
      probe: async (): Promise<SystemHealth> => {
        return probeResource(xpandDb, healthChecks)
      },
    },
    {
      probe: async (): Promise<SystemHealth> => {
        return probeResource(contactsDb, healthChecks)
      },
    },
  ]

  router.get('/health', {}, async (ctx) => {
    ctx.body = await pollSystemHealth('contacts', subsystems)
  })

  router.get('/health/db', {}, async (ctx) => {
    ctx.body = collectDbPoolMetrics(CONNECTIONS)
  })
}
