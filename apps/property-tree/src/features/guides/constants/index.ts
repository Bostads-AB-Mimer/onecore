import { ALLOWED_IMAGE_TYPES } from '@/shared/lib/fileConstants'

// Mirrors the limits enforced by core's upload route.
export const GUIDE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const GUIDE_IMAGE_MAX_DISPLAY = '5 MB'
export const GUIDE_IMAGE_TYPES = ALLOWED_IMAGE_TYPES

export const CALLOUT_OPTIONS = [
  { value: 'tip', label: 'Tips' },
  { value: 'note', label: 'Obs' },
  { value: 'warning', label: 'Varning' },
] as const
