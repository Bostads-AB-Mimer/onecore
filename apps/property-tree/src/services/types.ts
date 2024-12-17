import type { components } from './api/generated/api-types'

// Extract types from the generated schemas
export type Company = components['schemas']['Company']
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
  }
  _links?: {
    [key: string]: {
      href: string
    }
  }
}

// Type helpers for responses with links
export type WithLinks<T> = T & {
  _links: {
    self: { href: string }
    [key: string]: { href: string }
  }
}

// Extend base types with links
export type CompanyWithLinks = WithLinks<Company>
export type PropertyWithLinks = WithLinks<Property>
export type BuildingWithLinks = WithLinks<Building>
export type StaircaseWithLinks = WithLinks<Staircase>
export type ResidenceWithLinks = WithLinks<Residence>
export type RoomWithLinks = WithLinks<Room>
export type ComponentWithLinks = WithLinks<Component>
