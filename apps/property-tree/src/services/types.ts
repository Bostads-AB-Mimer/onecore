import type { paths } from './api/generated/api-types'

// Extract response types from the generated paths
type ApiResponse<T> = T extends {
  responses: { 200: { content: { 'application/json': infer R } } }
}
  ? R
  : never

// Extract common types from the API responses
export type Company = ApiResponse<paths['/companies/']['get']>['content']
export type Property = ApiResponse<paths['/properties']['get']>['content']
export type Building = ApiResponse<paths['/buildings']['get']>['content']
export type Staircase = ApiResponse<paths['/staircases']['get']>['content']
export type Residence = ApiResponse<paths['/residences']['get']>['content']
export type Room = ApiResponse<paths['/rooms']['get']>['content']
export type Component = ApiResponse<paths['/components']['get']>['content']

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
