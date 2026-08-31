// Identifies the property-base hierarchy that powers the inspection surface
// picker. Renaming these strings via the admin UI breaks the picker silently
// — keep them in sync with the seeded Ytskikt category in services/property
// (services/property/prisma/seed.ts).
export const SURFACE_CATEGORY_NAME = 'Ytskikt'

export const SURFACE_TYPES = ['Vägg', 'Golv', 'Tak'] as const
export type SurfaceType = (typeof SURFACE_TYPES)[number]
