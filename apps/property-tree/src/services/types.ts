import type {
  Room,
  Component,
  Residence,
  Building,
  Property,
  Staircase
} from './api/schemas'

export type {
  Room,
  Component,
  Residence,
  Building,
  Property,
  Staircase
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
