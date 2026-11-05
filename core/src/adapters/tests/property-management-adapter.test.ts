import nock from 'nock'
import { loggedAxios } from '@onecore/utilities'

import config from '../../common/config'
import * as propertyManagementAdapter from '../property-management-adapter'
import * as factory from '../../../test/factories'

describe(propertyManagementAdapter.getApartmentRentalPropertyInfo, () => {
  it('returns err if not found', async () => {
    nock(config.propertyInfoService.url)
      .get('/rentalPropertyInfo/apartment/1234')
      .reply(404)

    const result =
      await propertyManagementAdapter.getApartmentRentalPropertyInfo('1234')

    expect(result).toEqual({ ok: false, err: 'not-found' })
  })

  it('returns err if unexpected error', async () => {
    nock(config.propertyInfoService.url)
      .get('/rentalPropertyInfo/apartment/1234')
      .reply(500)

    const result =
      await propertyManagementAdapter.getApartmentRentalPropertyInfo('1234')

    expect(result).toEqual({ ok: false, err: 'unknown' })
  })

  it('returns ok and apartment info if 200', async () => {
    const apartmentInfo = factory.apartmentInfo.build()
    nock(config.propertyInfoService.url)
      .get('/rentalPropertyInfo/apartment/1234')
      .reply(200, { content: apartmentInfo })

    const result =
      await propertyManagementAdapter.getApartmentRentalPropertyInfo('1234')

    expect(result).toEqual({ ok: true, data: apartmentInfo })
  })
})

describe(propertyManagementAdapter.getRentalPropertyInfoFromXpand, () => {
  afterEach(() => jest.restoreAllMocks())

  it('returns status and content', async () => {
    const apartmentInfo = factory.apartmentInfo.build()
    nock(config.propertyInfoService.url)
      .get('/rentalPropertyInfo/1234')
      .reply(200, { content: apartmentInfo })

    const result =
      await propertyManagementAdapter.getRentalPropertyInfoFromXpand('1234')

    expect(result).toEqual({ status: 200, data: apartmentInfo })
  })

  it('leaves the call unbounded unless the caller sets a timeout', async () => {
    const getSpy = jest
      .spyOn(loggedAxios, 'get')
      .mockResolvedValue({ status: 200, data: { content: {} } })

    await propertyManagementAdapter.getRentalPropertyInfoFromXpand('1234')

    expect(getSpy.mock.calls[0][1]?.timeout).toBeUndefined()
  })

  it('passes a caller timeout through', async () => {
    const getSpy = jest
      .spyOn(loggedAxios, 'get')
      .mockResolvedValue({ status: 200, data: { content: {} } })

    await propertyManagementAdapter.getRentalPropertyInfoFromXpand('1234', {
      timeoutMs: 30_000,
    })

    expect(getSpy.mock.calls[0][1]?.timeout).toBe(30_000)
  })
})
