import KoaRouter from '@koa/router'
import { SystemHealth } from '@onecore/utilities'
import config from '../../common/config'
import { healthCheck as xledgerHealthCheck } from '../common/adapters/xledger-adapter'

const healthChecks: Map<string, SystemHealth> = new Map()

const probe = async (
  systemName: string,
  minimumMinutesBetweenRequests: number,
  checkFunction: () => any,
  activeMessage?: string
): Promise<SystemHealth> => {
  let currentHealth = healthChecks.get(systemName)

  if (
    !currentHealth ||
    Math.floor(
      (new Date().getTime() - currentHealth.timeStamp.getTime()) / 60000
    ) >= minimumMinutesBetweenRequests
  ) {
    try {
      const result = await checkFunction()
      if (result) {
        currentHealth = {
          status: result.status,
          name: result.name,
          subsystems: result.subsystems,
          timeStamp: new Date(),
        }
      } else {
        currentHealth = {
          status: 'active',
          name: systemName,
          timeStamp: new Date(),
        }
        if (activeMessage) currentHealth.statusMessage = activeMessage
      }
    } catch (error: any) {
      if (error instanceof ReferenceError) {
        currentHealth = {
          status: 'impaired',
          statusMessage: error.message || 'Reference error ' + systemName,
          name: systemName,
          timeStamp: new Date(),
        }
      } else {
        currentHealth = {
          status: 'failure',
          statusMessage: error.message || 'Failed to access ' + systemName,
          name: systemName,
          timeStamp: new Date(),
        }
      }
    }

    healthChecks.set(systemName, currentHealth)
  }
  return currentHealth
}

const subsystems = [
  {
    probe: async (): Promise<SystemHealth> => {
      return await probe(
        config.health.xledger.systemName,
        config.health.xledger.minimumMinutesBetweenRequests,
        xledgerHealthCheck
      )
    },
  },
]

export const routes = (router: KoaRouter) => {
  router.get('(.*)/health', async (ctx) => {
    const health: SystemHealth = {
      name: 'communication',
      status: 'active',
      timeStamp: new Date(),
      subsystems: [],
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
            health.status = 'impaired'
            health.statusMessage = 'Failure because of impaired subsystem'
          }
          break
        case 'unknown':
          if (health.status !== 'failure' && health.status !== 'impaired') {
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
