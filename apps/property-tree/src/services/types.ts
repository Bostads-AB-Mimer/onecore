import type { components } from './api/generated/api-types'

// Extract types from the generated schemas
export type Company = components['schemas']['Company']
export type CompanyDetails = components['schemas']['CompanyDetails']
export type Property = components['schemas']['Property']
export type Building = components['schemas']['Building']
export type Staircase = components['schemas']['Staircase']
export type Residence = components['schemas']['Residence']
export type Room = components['schemas']['Room']
export type Component = components['schemas']['Component']

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
