import axios from 'axios'
import { logger } from '@onecore/utilities'

import curvesConfig from '../config/curves'
import {
  EcoGuardApartmentNode,
  EcoGuardApartmentNodeSchema,
  EcoGuardDataResponse,
  EcoGuardDataResponseSchema,
  EcoGuardTokenResponseSchema,
} from '../types/curves'

const APARTMENT_NODE_TYPE = 13
const TOKEN_EXPIRY_BUFFER_MS = 60_000
const REQUEST_TIMEOUT_MS = 30_000

// Token cache (module-level, single instance). EcoGuard issues 14-day tokens
// so this typically refreshes once per fortnight per process.
let cachedToken: string | null = null
let tokenExpiresAt = 0

export const clearTokenCache = (): void => {
  cachedToken = null
  tokenExpiresAt = 0
}

export const getAccessToken = async (): Promise<string> => {
  const now = Date.now()
  if (cachedToken && tokenExpiresAt > now + TOKEN_EXPIRY_BUFFER_MS) {
    return cachedToken
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'password',
      username: curvesConfig.username,
      password: curvesConfig.password,
      issue_refresh_token: 'false',
    })

    const response = await axios.post(
      `${curvesConfig.baseUrl}/token`,
      body.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: REQUEST_TIMEOUT_MS,
      }
    )

    const parsed = EcoGuardTokenResponseSchema.parse(response.data)
    cachedToken = parsed.access_token
    tokenExpiresAt = now + parsed.expires_in * 1000
    return cachedToken
  } catch (err) {
    logger.error({ err }, 'curves-adapter.getAccessToken')
    throw new Error('Failed to authenticate with EcoGuard Curves')
  }
}

const apiBase = () => `${curvesConfig.baseUrl}/api/${curvesConfig.domain}`

const isUnauthorized = (err: unknown): boolean =>
  axios.isAxiosError(err) && err.response?.status === 401

// Runs `fn(token)` and retries once with a refreshed token if the upstream
// returns 401 (cached token likely expired faster than expected).
const withTokenRetry = async <T>(
  fn: (token: string) => Promise<T>
): Promise<T> => {
  let token = await getAccessToken()
  try {
    return await fn(token)
  } catch (err) {
    if (!isUnauthorized(err)) throw err
    clearTokenCache()
    token = await getAccessToken()
    return fn(token)
  }
}

export const getApartmentNode = async (
  objectNumber: string
): Promise<EcoGuardApartmentNode | null> => {
  try {
    const data = await withTokenRetry(async (token) => {
      const response = await axios.get(`${apiBase()}/nodes`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Version': '1',
        },
        params: {
          nodeType: APARTMENT_NODE_TYPE,
          objectNumber,
        },
        timeout: REQUEST_TIMEOUT_MS,
      })
      return response.data
    })

    const arr = Array.isArray(data) ? data : []
    const parsed = arr.map((entry) => EcoGuardApartmentNodeSchema.parse(entry))
    return parsed[0] ?? null
  } catch (err) {
    logger.error({ err }, 'curves-adapter.getApartmentNode')
    throw new Error('Failed to fetch apartment node from EcoGuard Curves')
  }
}

export const getNodeTemperatureSeries = async (
  nodeId: number,
  from: number,
  to: number,
  interval: 'H' | 'D'
): Promise<EcoGuardDataResponse> => {
  try {
    const data = await withTokenRetry(async (token) => {
      const response = await axios.get(`${apiBase()}/data`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Version': '1',
        },
        params: {
          nodeID: nodeId,
          includeSubNodes: true,
          from,
          to,
          interval,
          utl: 'T[avg,min,max]',
        },
        timeout: REQUEST_TIMEOUT_MS,
      })
      return response.data
    })

    return EcoGuardDataResponseSchema.parse(data)
  } catch (err) {
    logger.error({ err }, 'curves-adapter.getNodeTemperatureSeries')
    throw new Error('Failed to fetch temperature data from EcoGuard Curves')
  }
}
