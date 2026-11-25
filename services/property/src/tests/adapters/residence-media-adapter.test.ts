import axios, { AxiosError } from 'axios'

import {
  clearResidenceMediaCache,
  getResidenceMedia,
  normalizeRentalId,
} from '../../adapters/residence-media-adapter'

const IMAGES = 'https://pub.mimer.nu/bofaktablad/mediabank/byggnad'
const ENERGY = 'https://pub.mimer.nu/Bofaktablad/Energideklaration'
const RENTAL_ID = '705-025-01-0103'

// Mirrors the media host: listed files answer 200, everything else 404.
const mockPublishedFiles = (files: string[]) =>
  jest.spyOn(axios, 'head').mockImplementation(async (url) => ({
    status: files.includes(url) ? 200 : 404,
  }))

describe('residence-media-adapter', () => {
  beforeEach(() => {
    clearResidenceMediaCache()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('normalizeRentalId', () => {
    it('trims the space padding of Xpand codes', () => {
      expect(normalizeRentalId(' 705-025-01-0103  ')).toBe(RENTAL_ID)
    })

    it.each(['705-025', '705-025-01', '../../secret', '705-025-01-0103/16'])(
      'rejects %s',
      (rentalId) => {
        expect(normalizeRentalId(rentalId)).toBeNull()
      }
    )
  })

  describe('getResidenceMedia', () => {
    it('returns the residence images in file number order', async () => {
      mockPublishedFiles([
        `${IMAGES}/${RENTAL_ID}_1.jpg`,
        `${IMAGES}/${RENTAL_ID}_2.jpg`,
      ])

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result).toEqual({
        ok: true,
        data: {
          images: [
            `${IMAGES}/${RENTAL_ID}_1.jpg`,
            `${IMAGES}/${RENTAL_ID}_2.jpg`,
          ],
          imageLevel: 'residence',
          energyDeclarationUrl: null,
        },
      })
    })

    it('stops at the first gap in the numbering', async () => {
      mockPublishedFiles([
        `${IMAGES}/${RENTAL_ID}_1.jpg`,
        `${IMAGES}/${RENTAL_ID}_3.jpg`,
      ])

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result.ok && result.data.images).toEqual([
        `${IMAGES}/${RENTAL_ID}_1.jpg`,
      ])
    })

    it('falls back to the first 10 characters as shared images', async () => {
      mockPublishedFiles([`${IMAGES}/705-025-01_1.jpg`])

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result.ok && result.data).toMatchObject({
        images: [`${IMAGES}/705-025-01_1.jpg`],
        imageLevel: 'shared',
      })
    })

    it('falls back to the first 7 characters as shared images', async () => {
      mockPublishedFiles([`${IMAGES}/705-025_1.jpg`])

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result.ok && result.data).toMatchObject({
        images: [`${IMAGES}/705-025_1.jpg`],
        imageLevel: 'shared',
      })
    })

    it('never mixes images from different levels', async () => {
      mockPublishedFiles([
        `${IMAGES}/${RENTAL_ID}_1.jpg`,
        `${IMAGES}/705-025-01_1.jpg`,
        `${IMAGES}/705-025_1.jpg`,
      ])

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result.ok && result.data.images).toEqual([
        `${IMAGES}/${RENTAL_ID}_1.jpg`,
      ])
    })

    it('stops probing at 20 images', async () => {
      const files = Array.from(
        { length: 25 },
        (_, index) => `${IMAGES}/${RENTAL_ID}_${index + 1}.jpg`
      )
      mockPublishedFiles(files)

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result.ok && result.data.images).toHaveLength(20)
    })

    it('finds the energy declaration by the first three code segments', async () => {
      mockPublishedFiles([`${ENERGY}/705-025-01.jpg`])

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result).toEqual({
        ok: true,
        data: {
          images: [],
          imageLevel: null,
          energyDeclarationUrl: `${ENERGY}/705-025-01.jpg`,
        },
      })
    })

    it('returns invalid-rental-id without calling the media host', async () => {
      const head = mockPublishedFiles([])

      const result = await getResidenceMedia('705-025')

      expect(result).toEqual({ ok: false, err: 'invalid-rental-id' })
      expect(head).not.toHaveBeenCalled()
    })

    it('only treats 200 and 404 as answers', async () => {
      const head = mockPublishedFiles([])

      await getResidenceMedia(RENTAL_ID)

      const validateStatus = head.mock.calls[0][1]?.validateStatus
      expect(validateStatus?.(200)).toBe(true)
      expect(validateStatus?.(404)).toBe(true)
      expect(validateStatus?.(403)).toBe(false)
      expect(validateStatus?.(500)).toBe(false)
    })

    it('returns media-unavailable when the media host fails', async () => {
      jest
        .spyOn(axios, 'head')
        .mockRejectedValue(new AxiosError('Request failed with status 500'))

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result).toEqual({ ok: false, err: 'media-unavailable' })
    })

    it('returns media-unavailable when the media host times out', async () => {
      jest
        .spyOn(axios, 'head')
        .mockRejectedValue(new AxiosError('timeout', AxiosError.ECONNABORTED))

      const result = await getResidenceMedia(RENTAL_ID)

      expect(result).toEqual({ ok: false, err: 'media-unavailable' })
    })

    it('shares probes between residences with the same codes', async () => {
      const head = mockPublishedFiles([
        `${IMAGES}/705-025-01_1.jpg`,
        `${ENERGY}/705-025-01.jpg`,
      ])

      await getResidenceMedia('705-025-01-0103')
      const callsForFirst = head.mock.calls.length
      const second = await getResidenceMedia('705-025-01-0104')

      // Only the second residence's own images are probed again.
      expect(head.mock.calls.slice(callsForFirst).map(([url]) => url)).toEqual([
        `${IMAGES}/705-025-01-0104_1.jpg`,
      ])
      expect(second).toEqual({
        ok: true,
        data: {
          images: [`${IMAGES}/705-025-01_1.jpg`],
          imageLevel: 'shared',
          energyDeclarationUrl: `${ENERGY}/705-025-01.jpg`,
        },
      })
    })

    it('shares one in-flight probe between concurrent requests', async () => {
      const head = mockPublishedFiles([])

      await Promise.all([
        getResidenceMedia(RENTAL_ID),
        getResidenceMedia(RENTAL_ID),
      ])

      const urls = head.mock.calls.map(([url]) => url)
      expect(urls).toHaveLength(new Set(urls).size)
    })

    it('does not cache a failed probe', async () => {
      jest
        .spyOn(axios, 'head')
        .mockRejectedValueOnce(new AxiosError('Request failed with status 503'))
      mockPublishedFiles([`${IMAGES}/${RENTAL_ID}_1.jpg`])

      const first = await getResidenceMedia(RENTAL_ID)
      const second = await getResidenceMedia(RENTAL_ID)

      expect(first).toEqual({ ok: false, err: 'media-unavailable' })
      expect(second.ok && second.data.images).toEqual([
        `${IMAGES}/${RENTAL_ID}_1.jpg`,
      ])
    })
  })
})
