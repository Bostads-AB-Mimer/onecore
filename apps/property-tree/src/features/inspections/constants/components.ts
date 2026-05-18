import { components } from '@onecore/types'

import type { components as apiTypes } from '@/services/api/core/generated/api-types'

type FetchedComponent = apiTypes['schemas']['Component']

export const SURFACE_TYPES = components.SURFACE_TYPES
export type SurfaceType = components.SurfaceType

// Returns the upstream Type name (e.g. 'Vägg', 'Golv', 'Tak') for a fetched
// component instance. Used by the inspection picker to detect missing surfaces.
export function getTypeName(c: FetchedComponent): string | undefined {
  return c.model?.subtype?.componentType?.typeName
}
