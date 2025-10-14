import type { components } from './api/generated/api-types'
import type { components as coreComponents } from './api/core/generated/api-types'

// Extract types from the generated schemas
export type Company = components['schemas']['Company']
export type CompanyDetails = components['schemas']['CompanyDetails']
export type Property = components['schemas']['Property']
export type Building = components['schemas']['Building']
export type Staircase = components['schemas']['Staircase']
export type Residence = components['schemas']['Residence']
export type ResidenceSearchResult =
  components['schemas']['ResidenceSearchResult']
export type Room = components['schemas']['Room']
export type Component = components['schemas']['Component']

// Key-related types from core API
export type Key = coreComponents['schemas']['Key']
export type KeyLoan = coreComponents['schemas']['KeyLoan']
export type KeySystem = coreComponents['schemas']['KeySystem']

// Key type definitions aligned with keys-portal
export const KeyTypeLabels = {
  LGH: 'Lägenhet',
  PB: 'Postbox',
  FS: 'Fastighet',
  HN: 'Huvudnyckel',
} as const

export type KeyType = keyof typeof KeyTypeLabels

// Custom types that aren't in the API
export interface Issue {
  id: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in-progress' | 'resolved'
  room: string
  feature: string
  date: string
  residenceId: string
}

export interface NavigationItem {
  id: string
  name: string
  type: 'company' | 'property' | 'building' | 'staircase' | 'residence'
  children?: NavigationItem[]
  metadata?: {
    residenceId?: string
    propertyId?: string
    buildingId?: string
    staircaseId?: string
  }
  _links?: {
    [key: string]: {
      href: string
    }
  }
}

export interface DashboardCard {
  id: string
  title: string
  icon: any // LucideIcon type from lucide-react
  description: string
  path: string
  isExternal: boolean
  isDisabled: boolean
}
