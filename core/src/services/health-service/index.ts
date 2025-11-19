import KoaRouter from '@koa/router'
import config from '../../common/config'
import {
  loggedAxios as axios,
  HealthCheckTarget,
  pollSystemHealth,
  setAxiosExclusionFilters,
} from '@onecore/utilities'
import { SystemHealth, probe } from '@onecore/utilities'

setAxiosExclusionFilters([/.*?\/health$/])

const healthChecks: Map<string, SystemHealth> = new Map()

const oneCoreServiceProbe = async (
  systemName: string,
  minimumMinutesBetweenRequests: number,
  systemUrl: string
): Promise<SystemHealth> => {
  return await probe(
    systemName,
    healthChecks,
    minimumMinutesBetweenRequests,
    async () => {
      const result = await axios(systemUrl)

      if (result.status === 200) {
        return result.data
      } else {
        throw new Error(result.data)
      }
    }
  )
}

const subsystems: HealthCheckTarget[] = [
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
        config.health.propertyBase.systemName,
        config.health.propertyBase.minimumMinutesBetweenRequests,
        config.propertyBaseService.url + '/health'
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
      return await oneCoreServiceProbe(
        config.health.workOrder.systemName,
        config.health.workOrder.minimumMinutesBetweenRequests,
        config.workOrderService.url + '/health'
      )
    },
  },
  {
    probe: async (): Promise<SystemHealth> => {
      return await oneCoreServiceProbe(
        config.health.contacts.systemName,
        config.health.contacts.minimumMinutesBetweenRequests,
        config.workOrderService.url + '/health'
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
    ctx.body = await pollSystemHealth('core', subsystems)
  })
}
