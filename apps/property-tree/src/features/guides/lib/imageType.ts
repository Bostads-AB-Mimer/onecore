import type { GuideImageUploadRequest } from '@/entities/guide'

import { GUIDE_IMAGE_TYPES } from '../constants'

export type GuideImageContentType = GuideImageUploadRequest['contentType']

/** True when a browser-reported MIME type is one core accepts for guide images. */
export function isGuideImageType(type: string): type is GuideImageContentType {
  return (GUIDE_IMAGE_TYPES as readonly string[]).includes(type)
}
