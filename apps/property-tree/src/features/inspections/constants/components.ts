import { property } from '@onecore/types'

export const SURFACE_CODES = property.ComponentTypeCodeSchema.options
export type SurfaceCode = property.ComponentTypeCode

// Shown for a surface type that has no models in the library yet. Otherwise
// the menu uses the type's own name.
export const SURFACE_LABELS: Record<SurfaceCode, string> = {
  WALL: 'Vägg',
  FLOOR: 'Golv',
  CEILING: 'Tak',
}
