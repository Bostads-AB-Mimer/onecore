import { guides } from '@onecore/types'

import { CALLOUT_LABELS } from '@/shared/lib/callout'
import { ALLOWED_IMAGE_TYPES } from '@/shared/lib/fileConstants'

// Mirrors the limits enforced by core's upload route.
export const GUIDE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const GUIDE_IMAGE_MAX_DISPLAY = '5 MB'
export const GUIDE_IMAGE_TYPES = ALLOWED_IMAGE_TYPES

export const CALLOUT_OPTIONS = guides.CALLOUT_TYPE.map((value) => ({
  value,
  label: CALLOUT_LABELS[value],
}))

/** Narrows a Select value to a callout type. */
export const isCalloutType = (value: string): value is guides.CalloutType =>
  guides.CALLOUT_TYPE.some((type) => type === value)
