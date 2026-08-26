import { findKvvAreaCodesByResponsibles } from './index'

export type LeaseQuery = Record<string, string | string[] | undefined>

export type LeaseQueryResolution =
  | { ok: true; query: LeaseQuery; emptyResult: boolean }
  | { ok: false; reason: string }

// Sentinel injected when buildingManager resolves to zero areas, so callers
// still get a properly-formatted empty result from the leasing service.
const NO_MATCH_KVV_AREA_CODE = '__no_match__'

/**
 * Calls property-base to resolve `buildingManager` (Keycloak user IDs of
 * kvartersvärdar) into `kvvAreaCodes`, and strips `buildingManager` from the
 * forwarded query since leasing no longer accepts it.
 */
export async function resolveBuildingManagerToKvvAreaCodes(
  query: LeaseQuery
): Promise<LeaseQueryResolution> {
  const raw = query.buildingManager
  const userIds: string[] = (
    Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  ).filter((id) => id.trim().length > 0)

  const { buildingManager: _omit, ...rest } = query

  if (userIds.length === 0) {
    return { ok: true, query: rest, emptyResult: false }
  }

  const lookup = await findKvvAreaCodesByResponsibles(userIds)
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
