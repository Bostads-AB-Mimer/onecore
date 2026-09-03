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
  MapPin,
  Package,
  Store,
} from 'lucide-react'

import type { PropertyTreeLevel, RentalObjectType } from '../model/selection'

export const LEVEL_ICONS: Record<PropertyTreeLevel, LucideIcon> = {
  district: Landmark,
  kvvArea: Map,
  marketArea: MapPin,
  property: Building2,
  building: Hotel,
  parkingArea: Car,
  staircase: Home,
  // Object rows render their type's icon, not the level's; this is the
  // fallback for chips and anywhere a level icon is asked for generically.
  object: DoorOpen,
}

export const OBJECT_TYPE_ICONS: Record<RentalObjectType, LucideIcon> = {
  residence: DoorOpen,
  parkingSpace: Car,
  facility: Store,
  other: Package,
}
