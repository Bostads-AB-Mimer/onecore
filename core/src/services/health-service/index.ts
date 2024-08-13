import KoaRouter from '@koa/router'
import config from '../../common/config'
import { healthCheck as odooHealthCheck } from '../ticketing-service/adapters/odoo-adapter'
import {
  loggedAxios as axios,
  setAxiosExclusionFilters,
} from 'onecore-utilities'
import { SystemHealth } from 'onecore-types'

setAxiosExclusionFilters([/.*?\/health$/])

const healthChecks: Map<string, SystemHealth> = new Map()

const probe = async (
  systemName: string,
  minimumMinutesBetweenRequests: number,
  checkFunction: () => any
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
      }
    } catch (error: any) {
      currentHealth = {
        status: 'failure',
        statusMessage: error.message || 'Failed to access ' + systemName,
        name: systemName,
        timeStamp: new Date(),
      }
    }

    healthChecks.set(systemName, currentHealth)
  }
  return currentHealth
}

const oneCoreServiceProbe = async (
  systemName: string,
  minimumMinutesBetweenRequests: number,
  systemUrl: string
): Promise<SystemHealth> => {
  return await probe(systemName, minimumMinutesBetweenRequests, async () => {
    const result = await axios(systemUrl)

    if (result.status === 200) {
      return result.data
    } else {
      throw new Error(result.data)
    }
  })
}

const subsystems = [
  {
    probe: async (): Promise<SystemHealth> => {
      return await oneCoreServiceProbe(
        config.health.leasing.systemName,
        config.health.leasing.minimumMinutesBetweenRequests,
        config.tenantsLeasesService.url + '/health'
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await oneCoreServiceProbe(
        config.health.propertyManagement.systemName,
        config.health.propertyManagement.minimumMinutesBetweenRequests,
        config.propertyInfoService.url + '/health'
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await oneCoreServiceProbe(
        config.health.communication.systemName,
        config.health.communication.minimumMinutesBetweenRequests,
        config.communicationService.url + '/health'
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await probe(
        config.health.odoo.systemName,
        config.health.odoo.minimumMinutesBetweenRequests,
        odooHealthCheck
      )
    },
  },
]

/**
 * @swagger
 * openapi: 3.0.0
 * tags:
 *   - name: Health
 *     description: Operations related to service health
 */
export const routes = (router: KoaRouter) => {
  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Check system health status
   *     tags:
   *       - Health
   *     description: Retrieves the health status of the system and its subsystems.
   *     responses:
   *       '200':
   *         description: Successful response with system health status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 name:
   *                   type: string
   *                   example: core
   *                   description: Name of the system.
   *                 status:
   *                   type: string
   *                   example: active
   *                   description: Overall status of the system ('active', 'impaired', 'failure', 'unknown').
   *                 subsystems:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       name:
   *                         type: string
   *                         description: Name of the subsystem.
   *                       status:
   *                         type: string
   *                         enum: ['active', 'impaired', 'failure', 'unknown']
   *                         description: Status of the subsystem.
   *                       details:
   *                         type: string
   *                         description: Additional details about the subsystem status.
   */
  router.get('(.*)/health', async (ctx) => {
    const health: SystemHealth = {
      name: 'core',
      status: 'active',
      subsystems: [],
      timeStamp: new Date(),
    }

    // Iterate over subsystems
    for (const subsystem of subsystems) {
      const subsystemHealth = await subsystem.probe()
      health.subsystems?.push(subsystemHealth)

      switch (subsystemHealth.status) {
        case 'failure':
          health.status = 'failure'
          health.statusMessage = 'Failure because of failing subsystem(s)'
          break
        case 'impaired':
          if (health.status !== 'failure') {
            health.status = 'impaired'
            health.statusMessage = 'Failure because of impaired subsystem(s)'
          }
          break
        case 'unknown':
          if (health.status !== 'failure' && health.status !== 'impaired') {
            health.status = 'unknown'
            health.statusMessage =
              'Unknown because subsystem(s) status is unknown'
          }
          break
        default:
          break
      }
    }

    ctx.body = health
  })
}
