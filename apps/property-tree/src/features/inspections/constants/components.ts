import { property } from '@onecore/types'

import { SURFACE_CODE_LABELS } from '@/shared/lib/componentLabels'

export const SURFACE_CODES = property.ComponentTypeCodeSchema.options
export type SurfaceCode = property.ComponentTypeCode

export const SURFACE_LABELS = SURFACE_CODE_LABELS
