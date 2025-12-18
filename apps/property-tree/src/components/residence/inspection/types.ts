// TODO: revisit once we begin dealing with real data. This may
// not be the natural home for these definitions - currently mirrors
// the Lovable code

export interface InspectionRoom {
  roomId: string
  conditions: {
    wall1: string
    wall2: string
    wall3: string
    wall4: string
    floor: string
    ceiling: string
    details: string
  }
  actions: {
    wall1: string[]
    wall2: string[]
    wall3: string[]
    wall4: string[]
    floor: string[]
    ceiling: string[]
    details: string[]
  }
  componentNotes: {
    wall1: string
    wall2: string
    wall3: string
    wall4: string
    floor: string
    ceiling: string
    details: string
  }
  componentPhotos: {
    wall1: string[]
    wall2: string[]
    wall3: string[]
    wall4: string[]
    floor: string[]
    ceiling: string[]
    details: string[]
  }
  photos: string[]
  isApproved: boolean
  isHandled: boolean
}

export type InspectionStatus = 'draft' | 'in_progress' | 'completed'

// Snapshot av hyresgästinfo vid besiktningstillfället
export interface TenantSnapshot {
  name: string
  personalNumber: string
  phone?: string
  email?: string
}

// Auto-hämtad residence-info
export interface ResidenceInfo {
  id: string
  objectNumber: string // code från residence
  address: string // name från residence
  apartmentType: string | null
  size: number | null
}

export interface Inspection {
  id: string
  inspectionNumber: string
  date: string
  inspectedBy: string
  rooms: Record<string, InspectionRoom>
  status: InspectionStatus

  // Auto-hämtad residence-info
  residence: ResidenceInfo

  // Snapshot av hyresgäst vid besiktningstillfället
  tenant?: TenantSnapshot

  // Från formuläret
  needsMasterKey: boolean

  isCompleted?: boolean // Deprecated, use status instead
}

// Data som skickas från formulär till sparfunktion
export interface InspectionSubmitData {
  needsMasterKey: boolean
  tenant?: TenantSnapshot
}
