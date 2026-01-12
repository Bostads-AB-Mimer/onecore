import {
  DbConnection,
  collectDbPoolMetrics,
  HealthCheckTarget,
  SystemHealth,
  pollSystemHealth,
  probe,
} from '@onecore/utilities'
import config from '@src/common/config'
import { OkapiRouter } from 'koa-okapi-router'
import { AppInfrastructure } from '@src/context'

const healthChecks: Map<string, SystemHealth> = new Map()

export const routes = (router: OkapiRouter, infra: AppInfrastructure) => {
  const { xpandDb } = infra

  /**
   * Round-up of DB connections used by this service
   */
  // const CONNECTIONS: DbConnection[] = [
  //   {
  //     name: 'xpand',
  //     connection: xpandDb.get(),
  //   },
  // ]

  const subsystems: HealthCheckTarget[] = [
    {
      probe: async (): Promise<SystemHealth> => {
        return await probe(
          config.health.xpandDatabase.systemName,
          healthChecks,
          config.health.xpandDatabase.minimumMinutesBetweenRequests,
          async () => {
            await xpandDb.get().table('cmctc').limit(1)
          }
        )
      },
    },
  ]

  router.get('(.*)/health', {}, async (ctx) => {
    ctx.body = await pollSystemHealth('leasing', subsystems)
  })

  // router.get('(.*)/health/db', {}, async (ctx) => {
  //   ctx.body = collectDbPoolMetrics(CONNECTIONS)
  // })
}
