import { logger } from '@onecore/utilities'
import { z } from 'zod'

import {
  getUserById,
  getUsersByRole,
  type KeycloakUser,
} from '../auth-service/keycloak-admin-adapter'
import { PROPERTY_MANAGER_ROLE } from './constants'
import { KeycloakUserSummarySchema } from './schemas'

type RoleUsersResult = Awaited<ReturnType<typeof getUsersByRole>>

// Display staleness only: a renamed or added förvaltare shows late, nothing
// more. Validation paths must keep calling the adapter directly.
const ROLE_USERS_TTL_MS = 15 * 60 * 1000

interface RoleUsersEntry {
  promise: Promise<RoleUsersResult>
  expiresAt: number
}

const roleUsersCache = new Map<string, RoleUsersEntry>()

/** getUsersByRole for display paths (who is "responsible"), cached per role. */
export function getCachedUsersByRole(role: string): Promise<RoleUsersResult> {
  const now = Date.now()
  const hit = roleUsersCache.get(role)
  if (hit && hit.expiresAt > now) return hit.promise

  const entry: RoleUsersEntry = {
    promise: getUsersByRole(role),
    expiresAt: now + ROLE_USERS_TTL_MS,
  }
  // Failures resolve as ok:false rather than throw — evict them so one blip
  // doesn't pin a null "responsible" for the whole TTL.
  entry.promise.then((result) => {
    if (!result.ok && roleUsersCache.get(role) === entry) {
      roleUsersCache.delete(role)
    }
  })
  roleUsersCache.set(role, entry)
  return entry.promise
}

export function clearCachedUsersByRole(): void {
  roleUsersCache.clear()
}

// Keycloak returns `null` (not undefined) for unset optional attributes, while
// KeycloakUserSummarySchema declares them `.optional()` — which rejects null.
// Normalise here so every caller emits a parseable summary.
export function toUserSummary(user: KeycloakUser) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    email: user.email ?? undefined,
    mobilePhone: user.attributes?.mobilePhone?.[0] ?? undefined,
    employeeId: user.attributes?.employeeId?.[0] ?? undefined,
  }
}

export type UserSummary = z.infer<typeof KeycloakUserSummarySchema>

export type ResolveUserSummary = (userId: string | null) => UserSummary | null

// Resolves a single user by id. Use this instead of `resolvePropertyManagers`
// on per-request hot paths — Odoo calls GET /properties/:code/kvv-area for
// every errand, and `getUsersByRole` is uncached and expands the role's whole
// group tree just to find one user. Same degradation policy: Keycloak being
// down is logged and yields `null`, never a failed request.
export async function resolveUserById(
  userId: string | null
): Promise<UserSummary | null> {
  if (!userId) return null

  try {
    const result = await getUserById(userId)
    if (!result.ok) {
      logger.error(
        { err: result.err, userId },
        'keycloak-users.resolveUserById: getUserById failed — responsible will be null'
      )
      return null
    }

    // Guarded parse: an unexpected user shape must never turn a working
    // district lookup into a 500 — Odoo calls this per errand and only needs
    // the district. Degrade to `null` and log instead.
    const parsed = KeycloakUserSummarySchema.safeParse(
      toUserSummary(result.data)
    )
    if (!parsed.success) {
      logger.error(
        { err: parsed.error.issues, userId },
        'keycloak-users.resolveUserById: unexpected Keycloak user shape — responsible will be null'
      )
      return null
    }

    return parsed.data
  } catch (err) {
    logger.error(
      { err, userId },
      'keycloak-users.resolveUserById: Keycloak lookup threw — responsible will be null'
    )
    return null
  }
}

// Fetches every property-manager once and returns a resolver from Keycloak
// user id → user summary. Keycloak being down is logged and degrades to
// `null` for every id rather than failing the request (same policy as
// GET /cost-centers/:id/tree). Pass `needed: false` to skip the fetch entirely
// when no ids will be resolved.
export async function resolvePropertyManagers(
  needed = true
): Promise<ResolveUserSummary> {
  if (!needed) return () => null

  const result = await getUsersByRole(PROPERTY_MANAGER_ROLE)
  if (!result.ok) {
    logger.error(
      { err: result.err, role: PROPERTY_MANAGER_ROLE },
      'keycloak-users.resolvePropertyManagers: getUsersByRole failed — responsible users will be null'
    )
    return () => null
  }

  const byId = new Map(result.data.map((u) => [u.id, u]))
  return (userId) => {
    if (!userId) return null
    const user = byId.get(userId)
    return user ? toUserSummary(user) : null
  }
}
