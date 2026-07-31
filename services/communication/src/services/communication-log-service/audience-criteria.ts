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
  'objectType',
  'status',
  'leaseType',
  'parkingSpaceType',
] as const

/**
 * Flatten a lease-search-shaped audience filter object into normalized
 * (type, value) rows for dispatch_audience_criterion. One row per value.
 */
export function audienceCriteriaToRows(
  audienceCriteria?: Record<string, unknown>
): { type: string; value: string }[] {
  if (!audienceCriteria) return []
  const rows: { type: string; value: string }[] = []
  for (const type of AUDIENCE_CRITERION_KEYS) {
    const raw = audienceCriteria[type]
    if (raw == null) continue
    const values = Array.isArray(raw) ? raw : [raw]
    for (const v of values) {
      if (v == null || v === '') continue
      rows.push({ type, value: String(v) })
    }
  }
  return rows
}
