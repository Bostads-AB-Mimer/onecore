import request from 'supertest'

import app from '../app'
import * as residenceMediaAdapter from '../adapters/residence-media-adapter'

beforeEach(jest.restoreAllMocks)

describe('GET /residences/rental-id/:rentalId/media', () => {
  it('returns the published media', async () => {
    const media = {
      images: ['https://pub.mimer.nu/bofaktablad/mediabank/byggnad/a_1.jpg'],
      imageLevel: 'residence' as const,
      energyDeclarationUrl:
        'https://pub.mimer.nu/Bofaktablad/Energideklaration/a.jpg',
    }
    jest
      .spyOn(residenceMediaAdapter, 'getResidenceMedia')
      .mockResolvedValue({ ok: true, data: media })

    const res = await request(app.callback()).get(
      '/residences/rental-id/705-025-01-0103/media'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(media)
  })

  it('returns 200 with empty content when nothing is published', async () => {
    const media = { images: [], imageLevel: null, energyDeclarationUrl: null }
    jest
      .spyOn(residenceMediaAdapter, 'getResidenceMedia')
      .mockResolvedValue({ ok: true, data: media })

    const res = await request(app.callback()).get(
      '/residences/rental-id/705-025-01-0103/media'
    )

    expect(res.status).toBe(200)
    expect(res.body.content).toEqual(media)
  })

  it('returns 400 for a rental id that is not a residence code', async () => {
    jest
      .spyOn(residenceMediaAdapter, 'getResidenceMedia')
      .mockResolvedValue({ ok: false, err: 'invalid-rental-id' })

    const res = await request(app.callback()).get(
      '/residences/rental-id/705-025/media'
    )

    expect(res.status).toBe(400)
    expect(res.body.reason).toBe('invalid-rental-id')
  })

  it('returns 503 when the media host is unavailable', async () => {
    jest
      .spyOn(residenceMediaAdapter, 'getResidenceMedia')
      .mockResolvedValue({ ok: false, err: 'media-unavailable' })

    const res = await request(app.callback()).get(
      '/residences/rental-id/705-025-01-0103/media'
    )

    expect(res.status).toBe(503)
    expect(res.body.reason).toBe('media-unavailable')
  })
})
