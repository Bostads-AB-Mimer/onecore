import { Context } from 'koa'
import { guides } from '@onecore/types'
import { logger } from '@onecore/utilities'
import { z } from 'zod'

import * as fileStorageAdapter from '../../adapters/file-storage-adapter'
import { UpstreamError } from '../../adapters/communication-adapter/helpers'

// The communication service answers with a stable kebab-case error code (and
// zod issues for validation failures); proxy it instead of a generic message.
export const upstreamErrorBody = (upstream: UpstreamError | undefined) => ({
  error: upstream?.error ?? 'bad-request',
  ...(upstream?.issues ? { issues: upstream.issues } : {}),
})

/** Keycloak realm role that allows creating, editing and deleting guides. */
export const GUIDES_ADMIN_ROLE = 'guides-admin'

/** Presigned image URLs live long enough for a guide left open all day. */
export const IMAGE_URL_EXPIRY_SECONDS = 24 * 60 * 60

/**
 * Storage key prefix owned by the guides API. Files under it are created and
 * removed through /guides only, never through the generic /files routes.
 */
export const GUIDE_STORAGE_PREFIX = 'guide/'

/**
 * Leading bytes that identify each image format we accept. Checked against the
 * declared content type so a caller cannot store e.g. an HTML file as a PNG.
 */
const IMAGE_MAGIC_BYTES: Record<string, (buffer: Buffer) => boolean> = {
  // \x89PNG\r\n\x1a\n
  'image/png': (buffer) =>
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  // JFIF/Exif start-of-image marker
  'image/jpeg': (buffer) =>
    buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  // RIFF container with a WEBP form type at offset 8
  'image/webp': (buffer) =>
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP',
}

/** True when the file's magic bytes match the declared content type. */
export const matchesImageMagicBytes = (
  buffer: Buffer,
  contentType: string
): boolean => IMAGE_MAGIC_BYTES[contentType]?.(buffer) ?? false

/** Base64 without whitespace, line breaks or a data: URL prefix. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+=*$/

/** True when the string is plain base64 we can decode as-is. */
export const isPlainBase64 = (value: string): boolean =>
  BASE64_PATTERN.test(value)

const UuidSchema = z.string().uuid()

/**
 * True when a path parameter is a uuid. A value that is not one cannot name an
 * existing resource, so the route answers 404 without calling communication.
 */
export const isUuidParam = (value: string | undefined): boolean =>
  UuidSchema.safeParse(value).success

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
