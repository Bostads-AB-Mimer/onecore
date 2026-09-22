import { Context } from 'koa'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'

import * as fileStorageAdapter from '../../adapters/file-storage-adapter'

/** Keycloak realm role that allows creating, editing and deleting guides. */
export const GUIDES_ADMIN_ROLE = 'guides-admin'

/** Presigned image URLs live long enough for a guide left open all day. */
export const IMAGE_URL_EXPIRY_SECONDS = 24 * 60 * 60

export const isGuidesAdmin = (ctx: Context): boolean => {
  const roles: string[] = ctx.state.user?.realm_access?.roles ?? []
  return roles.includes(GUIDES_ADMIN_ROLE)
}

export const actingUserName = (ctx: Context): string =>
  ctx.state.user?.name ?? ctx.state.user?.preferred_username ?? 'system'

const withUrl = async (
  image: guides.GuideStepImage
): Promise<guides.GuideStepImageWithUrl> => {
  const result = await fileStorageAdapter.getFileUrl(
    image.storageKey,
    IMAGE_URL_EXPIRY_SECONDS
  )
  if (!result.ok) {
    // The guide is still readable without the picture; the client shows a
    // placeholder for an empty url.
    logger.warn(
      { err: result.err, storageKey: image.storageKey },
      'guides-service: could not resolve image url'
    )
    return { ...image, url: '' }
  }
  return { ...image, url: result.data.url }
}

/** Attach a presigned download URL to every image in a guide. */
export const withImageUrls = async (
  guide: guides.Guide
): Promise<guides.GuideWithUrls> => ({
  ...guide,
  steps: await Promise.all(
    guide.steps.map(async (step) => ({
      ...step,
      images: await Promise.all(step.images.map(withUrl)),
    }))
  ),
})

export const withImageUrl = withUrl

/** Best-effort removal of image files whose metadata rows are gone. */
export const deleteStorageFiles = async (storageKeys: string[]) => {
  const results = await Promise.allSettled(
    storageKeys.map((key) => fileStorageAdapter.deleteFile(key))
  )
  results.forEach((result, index) => {
    const failed =
      result.status === 'rejected' ||
      (!result.value.ok && result.value.err !== 'not_found')
    if (failed) {
      logger.warn(
        { storageKey: storageKeys[index] },
        'guides-service: could not delete image file'
      )
    }
  })
}
