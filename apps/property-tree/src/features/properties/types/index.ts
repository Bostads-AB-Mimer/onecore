export type SearchResult =
  | {
      type: 'property'
      id: string
      code: string
      designation: string
      municipality: string
    }
  | {
      type: 'residence'
      id: string
      name: string | null
      rentalId: string | null
    }
  | { type: 'building'; id: string; code: string; name: string | null }
  | {
      type: 'parking-space'
      id: string
      rentalId: string
      code: string
      name: string | null
      property: { name: string | null; code: string | null }
    }
  | {
      type: 'facility'
      id: string
      rentalId: string
      code: string
      name: string | null
      property: { name: string | null; code: string | null }
    }
  | {
      type: 'maintenance-unit'
      id: string
      code: string
      caption: string | null
      maintenanceType: string | null
      property: { name: string | null; code: string | null }
    }
