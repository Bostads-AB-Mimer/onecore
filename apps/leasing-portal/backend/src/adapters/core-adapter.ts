import { Method } from 'axios'
import {
  loggedAxios as axios,
  logger,
  probe,
  SystemHealth,
} from '@onecore/utilities'

const REQUEST_TIMEOUT_MS = 30_000
const HEALTH_TIMEOUT_MS = 5_000

export interface CoreRequest {
  method: Method
  path: string
  params?: Record<string, unknown>
  data?: unknown
}

export type CoreResult =
  | { ok: true; statusCode: number; data: unknown }
  | { ok: false; statusCode: number; err: unknown }

export interface CoreClient {
  /** Calls core as the user by forwarding their access token as a bearer. */
  request(accessToken: string, req: CoreRequest): Promise<CoreResult>
  health(): Promise<SystemHealth>
}

export const makeCoreClient = (config: { url: string }): CoreClient => {
  const healthChecks = new Map<string, SystemHealth>()

  return {
    async request(accessToken, req) {
      try {
        const response = await axios.request<unknown>({
          method: req.method,
          url: `${config.url}${req.path}`,
          params: req.params,
          data: req.data,
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: REQUEST_TIMEOUT_MS,
          validateStatus: () => true,
        })

        if (response.status >= 200 && response.status < 300) {
          return { ok: true, statusCode: response.status, data: response.data }
        }

        return { ok: false, statusCode: response.status, err: response.data }
      } catch (err) {
        logger.error(err, `Core request failed: ${req.method} ${req.path}`)
        return { ok: false, statusCode: 502, err: 'core-unavailable' }
      }
    },

    health: () =>
      probe('core', healthChecks, 1, async () => {
        const result = await axios.get(`${config.url}/health`, {
          timeout: HEALTH_TIMEOUT_MS,
        })
        return result.data
      }),
  }
}
