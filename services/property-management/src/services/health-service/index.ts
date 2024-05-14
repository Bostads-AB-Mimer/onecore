import KoaRouter from '@koa/router'
import { SystemHealth } from 'onecore-types'
import config from '../../common/config'
import knex from 'knex'

const subsystems = [
  {
    probe: async (): Promise<SystemHealth> => {
      try {
        const db = knex({
          client: 'mssql',
          connection: config.propertyManagementDatabase,
        })

        await db.table('MaterialOption').limit(1)

        return {
          name: 'property management database',
          status: 'active',
        }
      } catch (error: any) {
        return {
          name: 'property management database',
          status: 'failure',
          statusMessage: error.message,
        }
      }
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      try {
        const db = knex({
          client: 'mssql',
          connection: config.xpandDatabase,
        })

        await db.table('cmctc').limit(1)
        return {
          name: 'xpand database',
          status: 'active',
        }
      } catch (error: any) {
        return {
          name: 'xpand database',
          status: 'failure',
          statusMessage: error.message,
        }
      }
    },
  },
]

export const routes = (router: KoaRouter) => {
  router.get('(.*)/health', async (ctx) => {
    const health: SystemHealth = {
      name: 'property-management',
      status: 'active',
      subsystems: [],
      statusMessage: '',
    }

    // Iterate over subsystems
    for (const subsystem of subsystems) {
      const subsystemHealth = await subsystem.probe()
      health.subsystems?.push(subsystemHealth)

      switch (subsystemHealth.status) {
        case 'failure':
          health.status = 'failure'
          health.statusMessage = 'Failure because of failing subsystem'
          break
        case 'impaired':
          if (health.status !== 'failure') {
            console.log('health.status was', health.status, ', now: impaired')
            health.status = 'impaired'
            health.statusMessage = 'Failure because of impaired subsystem'
          }
          break
        case 'unknown':
          if (health.status !== 'failure' && health.status !== 'impaired') {
            console.log('health.status was', health.status, ', now: unknown')
            health.status = 'unknown'
            health.statusMessage = 'Unknown because subsystem status is unknown'
          }
          break
        default:
          break
      }
    }

    ctx.body = health
  })
}
