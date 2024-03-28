import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import { Lease, Contact } from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

interface RentalPropertyInfo {
  id: string
  address: string
  type: string
  size: string
  estateCode: string
  estateName: string
  blockCode: string
}

describe('routes', () => {
  let leaseMock: Lease,
    contactMock: Contact,
    rentalPropertyInfoMock: RentalPropertyInfo
  beforeEach(() => {
    leaseMock = {
      leaseId: '123',
      leaseNumber: '9433',
      leaseStartDate: new Date('2023-06-01T09:57:53.144Z'),
      leaseEndDate: new Date('2023-06-01T09:57:53.144Z'),
      status: 0,
      tenantContactIds: ['P4417', 'P5602'],
      address: undefined,
      noticeGivenBy: undefined,
      noticeDate: undefined,
      noticeTimeTenant: undefined,
      preferredMoveOutDate: undefined,
      contractDate: undefined,
      terminationDate: undefined,
      lastDebitDate: undefined,
      approvalDate: undefined,
      tenants: [
        {
          contactCode: 'P4417',
          contactKey: 'ABC',
          firstName: 'Anneli',
          lastName: 'Forsberg',
          nationalRegistrationNumber: '20740522-7848',
          birthDate: new Date('20740522'),
          address: {
            street: 'Gatvägen',
            number: '29',
            postalCode: '72489',
            city: 'Västerås',
          },
          phoneNumbers: [
            {
              isMainNumber: true,
              phoneNumber: '+465480978306',
              type: 'mobile',
            },
            {
              isMainNumber: false,
              phoneNumber: '+460777174972',
              type: 'home',
            },
          ],
          emailAddress: 'test@test.se',
          leaseIds: ['1'],
          leases: undefined,
          fullName: 'Anneli Forsberg',
          isTenant: true,
        },
        {
          contactCode: 'P5602',
          contactKey: 'ABC',
          firstName: 'Berit',
          lastName: 'Holmgren',
          nationalRegistrationNumber: '20850523-6536',
          birthDate: new Date('20850523'),
          address: {
            street: 'Gatvägen',
            number: '29',
            postalCode: '72489',
            city: 'Västerås',
          },
          phoneNumbers: [
            {
              isMainNumber: true,
              phoneNumber: '+467932495313',
              type: 'mobile',
            },
            {
              isMainNumber: false,
              phoneNumber: '+469731498801',
              type: 'home',
            },
          ],
          emailAddress: 'test@test.se',
          leaseIds: ['1'],
          leases: undefined,
          fullName: 'Berit Holmgren',
          isTenant: true,
        },
      ],
      rentalPropertyId: '456',
      rentalProperty: undefined,
      type: 'type',
      rentInfo: undefined,
    }

    contactMock = {
      contactCode: 'P965339',
      contactKey: 'DEF',
      firstName: 'Erik',
      lastName: 'Lundberg',
      fullName: 'Erik Lundberg',
      nationalRegistrationNumber: '194512121122',
      birthDate: new Date('1945-12-12T00:00:00.000Z'),
      address: {
        street: 'Gatvägen',
        number: '56',
        postalCode: '72266',
        city: 'Västerås',
      },
      phoneNumbers: [
        {
          isMainNumber: true,
          phoneNumber: '+460759429414',
          type: 'mobile',
        },
        {
          isMainNumber: false,
          phoneNumber: '+465292643751',
          type: 'home',
        },
      ],
      emailAddress: 'erik.lundberg@mimer.nu',
      leaseIds: ['123'],
      leases: undefined,
      isTenant: false,
    }

    rentalPropertyInfoMock = {
      id: '456',
      address: 'Gatvägen 29',
      type: '3 RUM OCH KÖK',
      size: '72',
      estateCode: '12345',
      estateName: 'Test Estate',
      blockCode: '987-654',
    }
  })
  it('should handle leaseId case', async () => {
    const getLeaseSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLease')
      .mockResolvedValue(leaseMock)

    const getRentalPropertyInfoSpy = jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
      .mockResolvedValue(rentalPropertyInfoMock)

    const res = await request(app.callback()).get(
      '/propertyInfo/123?typeOfNumber=leaseId'
    )

    expect(res.status).toBe(200)
    expect(getLeaseSpy).toHaveBeenCalledWith('123')
    expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
  })

  it('should handle propertyId case', async () => {
    const getRentalPropertyInfoSpy = jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
      .mockResolvedValue(rentalPropertyInfoMock)

    const res = await request(app.callback()).get(
      '/propertyInfo/456?typeOfNumber=propertyId'
    )

    expect(res.status).toBe(200)
    expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
  })

  it('should handle pnr case', async () => {
    const getLeasesForPnrSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLeasesForPnr')
      .mockResolvedValue([leaseMock])

    const getRentalPropertyInfoSpy = jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
      .mockResolvedValue(rentalPropertyInfoMock)

    const res = await request(app.callback()).get(
      '/propertyInfo/123?typeOfNumber=pnr'
    )

    expect(res.status).toBe(200)
    expect(getLeasesForPnrSpy).toHaveBeenCalledWith('123')
    expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
  })

  it('should handle phoneNumber case', async () => {
    const getContactForPhoneNumberSpy = jest
      .spyOn(tenantLeaseAdapter, 'getContactForPhoneNumber')
      .mockResolvedValue(contactMock)
    const getLeaseSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLease')
      .mockResolvedValue(leaseMock)

    const getRentalPropertyInfoSpy = jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
      .mockResolvedValue(rentalPropertyInfoMock)

    const res = await request(app.callback()).get(
      '/propertyInfo/1234567890?typeOfNumber=phoneNumber'
    )

    expect(res.status).toBe(200)
    expect(getContactForPhoneNumberSpy).toHaveBeenCalledWith('1234567890')
    expect(getLeaseSpy).toHaveBeenCalledWith('123')
    expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
  })
})
