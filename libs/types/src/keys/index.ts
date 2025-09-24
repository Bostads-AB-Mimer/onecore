// TODO: find out use, Remove in unused 


export type KeyType = 'LGH' | 'PB' | 'FS' | 'HN'
export type KeySystemType = 'MECHANICAL' | 'ELECTRONIC' | 'HYBRID'

export interface Key {
  id: string
  keyName: string
  keySequenceNumber?: number
  flexNumber?: number
  rentalObjectCode?: string
  keyType: KeyType
  keySystemId?: string | null
  createdAt: string
  updatedAt: string
}

export interface KeyLoan {
  id: string
  keys: string
  contact?: string
  lease?: string
  returnedAt?: string | null
  availableToNextTenantFrom?: string | null
  pickedUpAt?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
}

export interface KeySystem {
  id: string
  systemCode: string
  name: string
  manufacturer?: string
  type: KeySystemType
  propertyIds?: string
  installationDate?: string | null
  isActive?: boolean
  description?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
}

export interface Log {
  id: string
  userName: string
  eventType: 'creation' | 'update' | 'delete'
  objectType: 'key' | 'keySystem' | 'keyLoan'
  eventTime: string
  description?: string | null
}