import * as propertyBaseAdapter from '../../../adapters/property-base-adapter'

export type LeaseQuery = Record<string, string | string[] | undefined>

export type LeaseQueryResolution =
  | { ok: true; query: LeaseQuery; emptyResult: boolean }
  | { ok: false; reason: string }

// Sentinel kvv-area code injected when the buildingManager filter resolves to
// zero areas. Lets downstream code (notably Excel export) hit the leasing
// adapter and produce a properly-formatted empty result rather than having to
// build a synthetic response path.
const NO_MATCH_KVV_AREA_CODE = '__no_match__'

/**
 * Resolves the `buildingManager` query param (Keycloak user IDs) to
 * `kvvAreaCodes` (area codes) using the property-base service. The
 * `buildingManager` key is always removed from the forwarded query because the
 * leasing service no longer accepts it.
 *
 * Note: the param is called `buildingManager` for historical reasons but now
 * carries Keycloak user IDs of property managers (kvartersvärdar). This helper
 * is the seam that translates that into the area codes the leasing service
 * actually filters on.
 *
 * - When no user IDs are present, the query is forwarded unchanged (minus the
 *   `buildingManager` key).
 * - When the property-base lookup fails, returns a 500.
 * - When the lookup returns no kvv-areas, returns `emptyResult: true` and
 *   injects a sentinel kvv-area code so callers may either short-circuit or
 *   forward the query and get an empty result back from the leasing service.
 */
export async function resolveBuildingManagerToKvvAreaCodes(
  query: LeaseQuery
): Promise<LeaseQueryResolution> {
  const raw = query.buildingManager
  const userIds: string[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.length > 0
      ? [raw]
      : []

  // Strip buildingManager from forwarded query regardless of resolution path.
  const { buildingManager: _omit, ...rest } = query

  if (userIds.length === 0) {
    return { ok: true, query: rest, emptyResult: false }
  }

  const lookup =
    await propertyBaseAdapter.findKvvAreaCodesByResponsibles(userIds)
  if (!lookup.ok) {
    return { ok: false, reason: 'Failed to resolve building managers' }
  }
  if (lookup.data.length === 0) {
    return {
      ok: true,
      query: { ...rest, kvvAreaCodes: [NO_MATCH_KVV_AREA_CODE] },
      emptyResult: true,
    }
  }

  return {
    ok: true,
    query: { ...rest, kvvAreaCodes: lookup.data },
    emptyResult: false,
  }
}
