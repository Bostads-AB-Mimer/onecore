import nock from 'nock'

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
