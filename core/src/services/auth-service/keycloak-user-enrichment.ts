import { AxiosError } from 'axios'
import { keycloak } from '@onecore/types'
import { loggedAxios, logger } from '@onecore/utilities'

import config from '../../common/config'
import {
  getAdminToken,
  invalidateAdminTokenCache,
} from './keycloak-admin-adapter'

export type EnrichedKeycloakUser = keycloak.EnrichedKeycloakUser

type RawKeycloakUser = {
  id: string
  username?: string
  firstName?: string
  lastName?: string
  enabled?: boolean
  attributes?: Record<string, string[] | undefined>
}

// Raised when a single user fetch returns 401 so the batch can clear the admin-token
// cache and retry once with a fresh token (mirrors getUsersByRole behavior).
class AdminTokenRevokedError extends Error {}

const TTL_MS = 60_000

type CacheEntry = {
  user: EnrichedKeycloakUser | null
  expiresAt: number
}

// Module-level cache shared across requests. Null entries are cached too so a flurry
// of requests for a deactivated or missing user doesn't repeatedly hit Keycloak.
const userCache = new Map<string, CacheEntry>()

function readCache(id: string): CacheEntry | null {
  const entry = userCache.get(id)
  if (!entry) return null
  if (Date.now() >= entry.expiresAt) {
    userCache.delete(id)
    return null
  }
  return entry
}

function writeCache(id: string, user: EnrichedKeycloakUser | null): void {
  userCache.set(id, { user, expiresAt: Date.now() + TTL_MS })
}

function firstAttr(
  attrs: Record<string, string[] | undefined> | undefined,
  key: string
): string | null {
  const value = attrs?.[key]?.[0]
  return value && value.trim() !== '' ? value : null
}

function toEnrichedUser(raw: RawKeycloakUser): EnrichedKeycloakUser {
  const fullName = [raw.firstName, raw.lastName]
    .filter((part): part is string => !!part && part.trim() !== '')
    .join(' ')
    .trim()
  return {
    id: raw.id,
    name: fullName || raw.username || raw.id,
    phone: firstAttr(raw.attributes, 'mobilePhone'), // is called mobilePhone in Entra
    signature: firstAttr(raw.attributes, 'signature'),
  }
}

async function fetchOne(
  id: string,
  token: string
): Promise<EnrichedKeycloakUser | null> {
  const { url, realm } = config.auth.keycloak
  try {
    const res = await loggedAxios.get<RawKeycloakUser>(
      `${url}/admin/realms/${realm}/users/${encodeURIComponent(id)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: (status) => status >= 200 && status < 300,
      }
    )
    const raw = res.data
    if (!raw || raw.enabled === false) return null
    return toEnrichedUser(raw)
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 404) return null
      if (error.response?.status === 401) throw new AdminTokenRevokedError()
    }
    logger.error({ err: error, id }, 'keycloak-user-enrichment.fetchOne')
    return null
  }
}

async function fetchBatch(
  ids: string[],
  token: string
): Promise<Map<string, EnrichedKeycloakUser | null>> {
  const result = new Map<string, EnrichedKeycloakUser | null>()
  const settled = await Promise.allSettled(
    ids.map((id) => fetchOne(id, token).then((user) => ({ id, user })))
  )
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      result.set(outcome.value.id, outcome.value.user)
    } else if (outcome.reason instanceof AdminTokenRevokedError) {
      // Propagate so the caller can clear the cache and retry the whole batch.
      throw outcome.reason
    }
    // Other rejections were already logged in fetchOne and converted to null —
    // they can't reach this branch, but keep the loop defensive.
  }
  return result
}

/**
 * Resolves a collection of Keycloak user ids into enriched user objects suitable for
 * embedding in API responses (board / list views for förvaltningsområden).
 *
 * - Null/undefined ids and duplicates are filtered out up front.
 * - Returns a Map keyed by id. Missing or deactivated users map to `null` instead of
 *   throwing, so a single bad id never crashes the response.
 * - Uses a 60 s process-wide TTL cache. Callers should still gather all ids for one
 *   response into a single call to dedupe per request; the helper does not maintain
 *   any per-request context of its own.
 */
export async function enrichKeycloakUsers(
  ids: ReadonlyArray<string | null | undefined>
): Promise<Map<string, EnrichedKeycloakUser | null>> {
  const uniqueIds = Array.from(
    new Set(
      ids.filter((id): id is string => typeof id === 'string' && id !== '')
    )
  )

  const result = new Map<string, EnrichedKeycloakUser | null>()
  const idsToFetch: string[] = []

  for (const id of uniqueIds) {
    const cached = readCache(id)
    if (cached) {
      result.set(id, cached.user)
    } else {
      idsToFetch.push(id)
    }
  }

  if (idsToFetch.length === 0) return result

  try {
    let token: string
    try {
      token = await getAdminToken()
    } catch (error) {
      logger.error({ err: error }, 'keycloak-user-enrichment.getAdminToken')
      for (const id of idsToFetch) result.set(id, null)
      return result
    }

    let fetched: Map<string, EnrichedKeycloakUser | null>
    try {
      fetched = await fetchBatch(idsToFetch, token)
    } catch (error) {
      if (error instanceof AdminTokenRevokedError) {
        invalidateAdminTokenCache()
        const freshToken = await getAdminToken()
        fetched = await fetchBatch(idsToFetch, freshToken)
      } else {
        throw error
      }
    }

    for (const [id, user] of fetched) {
      writeCache(id, user)
      result.set(id, user)
    }
    // Any id that didn't make it into the fetched map (shouldn't happen, but be safe)
    // resolves to null so callers can rely on every requested id being present.
    for (const id of idsToFetch) {
      if (!result.has(id)) result.set(id, null)
    }
  } catch (error) {
    logger.error({ err: error }, 'keycloak-user-enrichment.enrichKeycloakUsers')
    for (const id of idsToFetch) {
      if (!result.has(id)) result.set(id, null)
    }
  }

  return result
}

// Exported for tests only — clears the TTL cache so each test starts clean.
export function _resetUserCacheForTests(): void {
  userCache.clear()
}
