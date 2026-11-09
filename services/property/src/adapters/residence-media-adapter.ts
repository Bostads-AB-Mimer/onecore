import axios from 'axios'
import { logger } from '@onecore/utilities'
import { property } from '@onecore/types'

// Photos and energy declarations are static files on Mimer's public media
// host. It has no listing endpoint, so files are found by probing their names.
const MEDIA_BASE_URL = 'https://pub.mimer.nu'
const IMAGES_PATH = 'bofaktablad/mediabank/byggnad'
const ENERGY_DECLARATION_PATH = 'Bofaktablad/Energideklaration'

const REQUEST_TIMEOUT_MS = 5_000
// Guards the sequential probing against an unexpectedly long numbering.
const MAX_IMAGES = 20

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
  `${MEDIA_BASE_URL}/${IMAGES_PATH}/${code}_${fileNumber}.jpg`

const getEnergyDeclarationUrl = (rentalId: string): string =>
  `${MEDIA_BASE_URL}/${ENERGY_DECLARATION_PATH}/${rentalId.slice(0, ENERGY_DECLARATION_CODE_LENGTH)}.jpg`

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

const findImages = async (
  rentalId: string
): Promise<Pick<property.ResidenceMedia, 'images' | 'imageLevel'>> => {
  const residenceImages = await findImagesForCode(rentalId)
  if (residenceImages.length > 0) {
    return { images: residenceImages, imageLevel: 'residence' }
  }

  // Levels are never mixed: the first level with images wins.
  for (const length of SHARED_IMAGE_CODE_LENGTHS) {
    const sharedImages = await findImagesForCode(rentalId.slice(0, length))
    if (sharedImages.length > 0) {
      return { images: sharedImages, imageLevel: 'shared' }
    }
  }

  return { images: [], imageLevel: null }
}

const findEnergyDeclaration = async (
  rentalId: string
): Promise<string | null> => {
  const url = getEnergyDeclarationUrl(rentalId)
  return (await fileExists(url)) ? url : null
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
      findEnergyDeclaration(normalizedRentalId),
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
