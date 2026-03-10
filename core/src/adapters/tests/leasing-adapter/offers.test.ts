import nock from 'nock'

import config from '../../../common/config'
import * as leasingAdapter from '../../leasing-adapter'
import * as factory from '../../../../test/factories'
import assert from 'assert'
import { OfferStatus } from '@onecore/types'

describe(leasingAdapter.createOffer, () => {
  it('should try to create an offer', async () => {
    nock(config.tenantsLeasesService.url)
      .post('/offer')
      .reply(201, { content: { id: 1 } })

    const result = await leasingAdapter.createOffer({
      expiresAt: new Date(),
      sentAt: new Date(),
      listingId: 1,
      applicantId: 1,
      selectedApplicants: [],
      status: 1,
    })
    assert(result.ok)

    expect(result.data).toEqual({ id: 1 })
  })
})

describe(leasingAdapter.getOfferByOfferId, () => {
  it('should try to get offer', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/offers/123')
      .reply(200, {
        content: factory.detailedOffer.build({
          id: 123,
          status: OfferStatus.Active,
          listingId: 456,
        }),
      })

    const res = await leasingAdapter.getOfferByOfferId(123)

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.listingId).toBe(456)
      expect(res.data.status).toBe(OfferStatus.Active)
      expect(res.data.id).toBe(123)
    }
  })

  it('should return 404 on not found', async () => {
    nock(config.tenantsLeasesService.url).get('/offers/123').reply(404)

    const res = await leasingAdapter.getOfferByOfferId(123)
    expect(res).toEqual({ ok: false, err: 'not-found' })
  })
})

describe(leasingAdapter.getOffersForContact, () => {
  it('should try to get offers', async () => {
    const offer = factory.offerWithRentalObjectCode.build()
    nock(config.tenantsLeasesService.url)
      .get('/contacts/P174965/offers')
      .reply(200, {
        content: [offer],
      })

    const result = await leasingAdapter.getOffersForContact('P174965')
    assert(result.ok)
    expect(result.data).toEqual([expect.objectContaining({ id: offer.id })])
  })

  it('should return 404 on not found', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/contacts/P174965/offers')
      .reply(404)

    const res = await leasingAdapter.getOffersForContact('P174965')
    expect(res).toEqual({ ok: false, err: 'not-found' })
  })

  it('should return an empty array if no offers are found', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/contacts/P174965/offers')
      .reply(200, {
        content: [],
      })

    const res = await leasingAdapter.getOffersForContact('P174965')
    expect(res).toEqual({ ok: true, data: [] })
  })

  it('should handle server errors gracefully', async () => {
    nock(config.tenantsLeasesService.url)
      .get('/contacts/P174965/offers')
      .reply(500)

    const res = await leasingAdapter.getOffersForContact('P174965')
    expect(res).toEqual({ ok: false, err: 'unknown' })
  })
})

describe(leasingAdapter.updateOfferSentAt, () => {
  it('returns err if leasing responds with 400', async () => {
    nock(config.tenantsLeasesService.url).put('/offers/1/sent-at').reply(400)

    const result = await leasingAdapter.updateOfferSentAt(1, new Date())
    expect(result).toEqual({ ok: false, err: 'bad-params' })
  })

  it('returns err if leasing responds with 404', async () => {
    nock(config.tenantsLeasesService.url).put('/offers/1/sent-at').reply(404)

    const result = await leasingAdapter.updateOfferSentAt(1, new Date())
    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns err if leasing responds with 500', async () => {
    nock(config.tenantsLeasesService.url).put('/offers/1/sent-at').reply(500)

    const result = await leasingAdapter.updateOfferSentAt(1, new Date())
    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns ok if leasing responds with 200', async () => {
    nock(config.tenantsLeasesService.url).put('/offers/1/sent-at').reply(200)

    const result = await leasingAdapter.updateOfferSentAt(1, new Date())
    expect(result).toEqual({ ok: true, data: null })
  })
})
