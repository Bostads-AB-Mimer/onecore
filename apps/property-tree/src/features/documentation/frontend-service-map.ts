/**
 * Curated mapping per frontend → services it reaches through `core`.
 * Keys + values are node IDs from `docs/architecture/onecore-platform.mmd`.
 *
 * Each value includes `core` so the highlighted subgraph stays connected
 * (frontend → core → services). Update this when integrations are added
 * or removed.
 */
export const frontendServiceMap: Record<string, string[]> = {
  ip: ['core', 'leasing', 'contacts', 'economy', 'propmgmt', 'comm'],
  kp: ['core', 'keys', 'leasing', 'property', 'contacts', 'filestorage'],
  pt: [
    'core',
    'property',
    'propmgmt',
    'contacts',
    'inspection',
    'filestorage',
    'workorder',
    'economy',
    'comm',
  ],
}
