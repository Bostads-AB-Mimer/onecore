// Only what usePropertyFilters actually constructs. The old cross-type search
// (residences, buildings, parking, facilities) lives on in git history.
export type SearchResult =
  | {
      type: 'property'
      id: string
      code: string
      designation: string
      municipality: string
    }
  | {
      type: 'maintenance-unit'
      id: string
      code: string
      caption: string | null
      maintenanceType: string | null
      property: { name: string | null; code: string | null }
    }
