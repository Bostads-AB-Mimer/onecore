// Icon vocabulary for the picker, shared by the rows and the type-filter
// buttons. Levels use the same icons as the sidebar navigation.

import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Car,
  DoorOpen,
  Home,
  Hotel,
  Landmark,
  Map,
  Package,
  Store,
} from 'lucide-react'

import type { AudienceLevel, AudienceObjectType } from '../model/selection'

export const LEVEL_ICONS: Record<AudienceLevel, LucideIcon> = {
  district: Landmark,
  kvvArea: Map,
  property: Building2,
  building: Hotel,
  parkingArea: Car,
  staircase: Home,
}

export const OBJECT_TYPE_ICONS: Record<AudienceObjectType, LucideIcon> = {
  residence: DoorOpen,
  parkingSpace: Car,
  facility: Store,
  other: Package,
}
