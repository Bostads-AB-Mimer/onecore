import { property } from '@onecore/types'
import { logger } from '@onecore/utilities'

// Audience dimensions we persist as filterable criterion rows. Presentation
// keys (page/limit/sort/q) are intentionally excluded. Values are stored
// exactly as selected — no hierarchy ancestors, no resolution. Addresses are
// resolved to building/property at send time, so they arrive under those keys.
const AUDIENCE_CRITERION_KEYS = [
  'districtNames',
  'buildingCodes',
  'areaCodes',
  'kvvAreaCodes',
  'property',
  'parkingAreaCodes',
  'staircaseCodes',
  'objectType',
  'status',
  'leaseType',
  'parkingSpaceType',
] as const

// The audience picker names this dimension in the plural (matching its
// repeatable search param); both land as the 'objectType' criterion.
const KEY_ALIASES: Record<string, (typeof AUDIENCE_CRITERION_KEYS)[number]> = {
  objectTypes: 'objectType',
}

const OBJECT_TYPES = new Set<string>(property.RENTAL_OBJECT_TYPES)

/**
 * Flatten a lease-search-shaped audience filter object into normalized
 * (type, value) rows for dispatch_audience_criterion. One row per value.
 *
 * objectType values must use the shared rental-object vocabulary; anything
 * else is dropped and logged, because the search side queries those values —
 * storing a foreign dialect (e.g. lease-search's 'bostad') would make the
 * dispatch unmatchable by every object-type filter.
 */
export function audienceCriteriaToRows(
  audienceCriteria?: Record<string, unknown>
): { type: string; value: string }[] {
  if (!audienceCriteria) return []
  const rows: { type: string; value: string }[] = []
  const seen = new Set<string>()

  for (const [key, raw] of Object.entries(audienceCriteria)) {
    const type =
      KEY_ALIASES[key] ??
      (AUDIENCE_CRITERION_KEYS as readonly string[]).find((k) => k === key)
    if (!type || raw == null) continue

    const values = Array.isArray(raw) ? raw : [raw]
    for (const v of values) {
      if (v == null || v === '') continue
      const value = String(v)
      if (type === 'objectType' && !OBJECT_TYPES.has(value)) {
        logger.warn(
          { value, expected: property.RENTAL_OBJECT_TYPES },
          'audienceCriteriaToRows: dropping unknown objectType value'
        )
        continue
      }
      const rowKey = `${type}:${value}`
      if (seen.has(rowKey)) continue
      seen.add(rowKey)
      rows.push({ type: type as string, value })
    }
  }
  return rows
}
