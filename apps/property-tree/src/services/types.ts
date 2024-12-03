import type {
  RoomResponse,
  ComponentResponse,
  ResidenceResponse,
  BuildingResponse,
  PropertyResponse,
  StaircaseResponse
} from './api/schemas'

export type Room = RoomResponse
export type Component = ComponentResponse
export type Residence = ResidenceResponse
export type Building = BuildingResponse
export type Property = PropertyResponse
export type Staircase = StaircaseResponse

export interface NavigationItem {
  id: string
  name: string
  type: 'area' | 'property' | 'building' | 'staircase' | 'residence'
  children?: NavigationItem[]
  metadata?: {
    residenceId?: string
  }
}
