import nock from 'nock'
import axios from 'axios'

import config from '../../../common/config'
import * as propertyBaseAdapter from '../../property-base-adapter'

// Match the global validateStatus set by the leasing-adapter at runtime.
// Without this, axios throws on non-2xx and the 404 branch is unreachable.
beforeAll(() => {
  axios.defaults.validateStatus = (status) => status >= 200 && status < 500
})

describe('property-base-adapter.getRentalObjectType', () => {
  it('returns type on 200 response', async () => {
    const rentalId = '101-002-03-0201'
    const typeData = { code: 'APARTMENT', name: 'Lagenhet' }

    nock(config.propertyBaseService.url)
      .get(`/rental-objects/${rentalId}/type`)
      .reply(200, { content: typeData })

    const result = await propertyBaseAdapter.getRentalObjectType(rentalId)

    expect(result).toEqual({ ok: true, data: typeData })
  })

  it('returns { ok: false, err: "not-found" } on 404 response', async () => {
    const rentalId = 'non-existent-id'

    nock(config.propertyBaseService.url)
      .get(`/rental-objects/${rentalId}/type`)
      .reply(404, { error: 'Not found' })

    const result = await propertyBaseAdapter.getRentalObjectType(rentalId)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('not-found')
    }
  })

  it('returns { ok: false, err: "unknown" } on other error responses', async () => {
    const rentalId = '101-002-03-0201'

    nock(config.propertyBaseService.url)
      .get(`/rental-objects/${rentalId}/type`)
      .reply(400, { error: 'Bad request' })

    const result = await propertyBaseAdapter.getRentalObjectType(rentalId)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })

  it('returns { ok: false, err: "unknown" } on network error', async () => {
    const rentalId = '101-002-03-0201'

    nock(config.propertyBaseService.url)
      .get(`/rental-objects/${rentalId}/type`)
      .replyWithError('Connection refused')

    const result = await propertyBaseAdapter.getRentalObjectType(rentalId)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.err).toBe('unknown')
    }
  })
})
