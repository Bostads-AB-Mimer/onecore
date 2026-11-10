import axios from 'axios'
import { logger } from '@onecore/utilities'
import { property } from '@onecore/types'

import config from '@src/config/media'
import { cachedKeyed } from '@src/utils/promise-cache'

// Photos and energy declarations are static files on Mimer's public media
// host. It has no listing endpoint, so files are found by probing their names.
const IMAGES_PATH = 'bofaktablad/mediabank/byggnad'
const ENERGY_DECLARATION_PATH = 'Bofaktablad/Energideklaration'

const REQUEST_TIMEOUT_MS = 5_000
// Guards the sequential probing against an unexpectedly long numbering.
const MAX_IMAGES = 20
// Probe results are cached per file code, so all residences sharing a code
// (e.g. every apartment in a building) share one round of HEAD requests.
// Failures are never cached, so an outage doesn't outlive itself.
const PROBE_CACHE_TTL_MS = 60 * 60 * 1000

// Xpand residence code, e.g. 705-025-01-0103. The fixed segment widths are what
// make the character prefixes below land on segment boundaries.
const RENTAL_ID_PATTERN =
  /^[0-9A-Za-z]{3}-[0-9A-Za-z]{3}-[0-9A-Za-z]{2}-[0-9A-Za-z]{4}$/

// Photos shared by several residences are named after the start of the code.
const SHARED_IMAGE_CODE_LENGTHS = [10, 7]
const ENERGY_DECLARATION_CODE_LENGTH = 10

export type ResidenceMediaError = 'invalid-rental-id' | 'media-unavailable'

type ResidenceMediaResult =
  | { ok: true; data: property.ResidenceMedia }
  | { ok: false; err: ResidenceMediaError }

const getImageUrl = (code: string, fileNumber: number): string =>
  `${config.baseUrl}/${IMAGES_PATH}/${code}_${fileNumber}.jpg`

const getEnergyDeclarationUrl = (code: string): string =>
  `${config.baseUrl}/${ENERGY_DECLARATION_PATH}/${code}.jpg`

/** Returns the trimmed rental id, or null if it isn't a residence code. */
export const normalizeRentalId = (rentalId: string): string | null => {
  const trimmed = rentalId.trim()
  return RENTAL_ID_PATTERN.test(trimmed) ? trimmed : null
}

const fileExists = async (url: string): Promise<boolean> => {
  // Any other status rejects, so an outage is never read as a missing file.
  const response = await axios.head(url, {
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: (status) => status === 200 || status === 404,
  })
  return response.status === 200
}

// The numbering ends at the first gap: with _1 and _3 present, _3 isn't found.
const findImagesForCode = async (code: string): Promise<string[]> => {
  const images: string[] = []
  for (let fileNumber = 1; fileNumber <= MAX_IMAGES; fileNumber++) {
    const url = getImageUrl(code, fileNumber)
    if (!(await fileExists(url))) break
    images.push(url)
  }
  return images
}

const imagesByCode = cachedKeyed(PROBE_CACHE_TTL_MS, findImagesForCode)

const findImages = async (
  rentalId: string
): Promise<Pick<property.ResidenceMedia, 'images' | 'imageLevel'>> => {
  const residenceImages = await imagesByCode.get(rentalId)
  if (residenceImages.length > 0) {
    return { images: residenceImages, imageLevel: 'residence' }
  }

  // Levels are never mixed: the first level with images wins.
  for (const length of SHARED_IMAGE_CODE_LENGTHS) {
    const sharedImages = await imagesByCode.get(rentalId.slice(0, length))
    if (sharedImages.length > 0) {
      return { images: sharedImages, imageLevel: 'shared' }
    }
  }

  return { images: [], imageLevel: null }
}

const findEnergyDeclaration = async (code: string): Promise<string | null> => {
  const url = getEnergyDeclarationUrl(code)
  return (await fileExists(url)) ? url : null
}

const energyDeclarationByCode = cachedKeyed(
  PROBE_CACHE_TTL_MS,
  findEnergyDeclaration
)

/** Drops all cached probe results. */
export const clearResidenceMediaCache = (): void => {
  imagesByCode.clear()
  energyDeclarationByCode.clear()
}

export const getResidenceMedia = async (
  rentalId: string
): Promise<ResidenceMediaResult> => {
  const normalizedRentalId = normalizeRentalId(rentalId)
  if (!normalizedRentalId) {
    return { ok: false, err: 'invalid-rental-id' }
  }

  try {
    const [images, energyDeclarationUrl] = await Promise.all([
      findImages(normalizedRentalId),
      energyDeclarationByCode.get(
        normalizedRentalId.slice(0, ENERGY_DECLARATION_CODE_LENGTH)
      ),
    ])

    return { ok: true, data: { ...images, energyDeclarationUrl } }
  } catch (err: unknown) {
    logger.error(
      {
        status: axios.isAxiosError(err) ? err.response?.status : undefined,
        error: err instanceof Error ? err.message : String(err),
      },
      'residence-media-adapter.getResidenceMedia'
    )
    return { ok: false, err: 'media-unavailable' }
  }
}
