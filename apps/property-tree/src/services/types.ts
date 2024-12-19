import type { components } from './api/generated/api-types'

// Extract types from the generated schemas
export type Company = components['schemas']['Company']
export type Property = components['schemas']['Property']
export type Building = components['schemas']['Building']
export type Staircase = components['schemas']['Staircase']
export type Residence = components['schemas']['Residence']
export type Room = components['schemas']['Room']
export type Component = components['schemas']['Component']

export type PropertyLinks = components['schemas']['PropertyLinks']
export type BuildingLinks = components['schemas']['BuildingLinks']
export type CompanyLinks = components['schemas']['CompanyLinks']
export type StaircaseLinks = components['schemas']['StaircaseLinks']
export type ResidenceLinks = components['schemas']['ResidenceLinks']
export type RoomLinks = components['schemas']['RoomLinks']
export type ComponentLinks = components['schemas']['ComponentLinks']

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
  }
  _links?: {
    [key: string]: {
      href: string
    }
  }
}

// Extend base types with links
export type CompanyWithLinks = Company & CompanyLinks
export type PropertyWithLinks = Property & PropertyLinks
export type BuildingWithLinks = Building & BuildingLinks
export type StaircaseWithLinks = Staircase & StaircaseLinks
export type ResidenceWithLinks = Residence & ResidenceLinks
export type RoomWithLinks = Room & RoomLinks
export type ComponentWithLinks = Component & ComponentLinks
