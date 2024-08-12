import KoaRouter from '@koa/router'
import config from '../../common/config'
import {
  loggedAxios as axios,
  setAxiosExclusionFilters,
} from 'onecore-utilities'
import { SystemHealth } from 'onecore-types'

setAxiosExclusionFilters([/.*?\/health$/])

const oneCoreServiceProbe = async (
  systemName: string,
  systemUrl: string
): Promise<SystemHealth> => {
  try {
    const result = await axios(systemUrl)

    if (result.status === 200) {
      return result.data
    } else {
      return {
        name: systemName,
        status: 'failure',
        statusMessage: result.data,
      }
    }
  } catch (error: any) {
    return {
      name: systemName,
      status: 'failure',
      statusMessage: error.message,
    }
  }
}

const subsystems = [
  {
    probe: async (): Promise<SystemHealth> => {
      return await oneCoreServiceProbe(
        'leasing',
        config.tenantsLeasesService.url + '/health'
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await oneCoreServiceProbe(
        'property-management',
        config.propertyInfoService.url + '/health'
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await oneCoreServiceProbe(
        'communication',
        config.communicationService.url + '/health'
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
