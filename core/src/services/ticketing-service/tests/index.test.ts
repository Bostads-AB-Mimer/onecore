import request from 'supertest'
import KoaRouter from '@koa/router'
import Koa from 'koa'
import * as tenantLeaseAdapter from '../../../adapters/leasing-adapter'
import * as propertyManagementAdapter from '../../../adapters/property-management-adapter'
import { routes } from '../index'
import bodyParser from 'koa-bodyparser'
import { Lease, Contact, RentalPropertyInfo } from 'onecore-types'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

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
      id: '705-022-04-0201',
      type: 'Apartment',
      property: {
        rentalTypeCode: 'KORTTID',
        rentalType: 'Korttidskontrakt',
        address: 'STENTORPSGATAN 9 A',
        code: '0201',
        number: '1101',
        type: '3 rum och kök',
        entrance: '04',
        floor: '2',
        hasElevator: false,
        washSpace: 'B',
        area: 73,
        estateCode: '02301',
        estate: 'KOLAREN 1',
        buildingCode: '705-022',
        building: 'STENTORPSGATAN 7-9',
      },
      maintenanceUnits: [
        {
          estateCode: '02301',
          estate: 'KOLAREN 1',
          code: '705Y01',
          caption: 'Skötselyta/Mark',
          typeCode: null,
          typeCaption: null,
        },
        {
          estateCode: '02301',
          estate: 'KOLAREN 1',
          code: '705S18',
          caption: 'STENTORPG. 1-13, 2-16',
          typeCode: 'TRS',
          typeCaption: 'Trappstädning',
        },
        {
          estateCode: '02301',
          estate: 'KOLAREN 1',
          code: '705T17',
          caption: 'TVÄTTSTUGA Stentorpsgatan 13 B',
          typeCode: 'TVÄTTSTUGA',
          typeCaption: 'Tvättstuga',
        },
        {
          estateCode: '02301',
          estate: 'KOLAREN 1',
          code: '705M03',
          caption: 'Miljöbod Ö48 Stentorpsg. 13',
          typeCode: 'MILJÖBOD',
          typeCaption: 'Miljöbod',
        },
        {
          estateCode: '02301',
          estate: 'KOLAREN 1',
          code: '705S12',
          caption: 'SKYDDSRUM Stentorpsgatan 9 C',
          typeCode: 'SKY',
          typeCaption: 'Skyddsrum',
        },
        {
          estateCode: '02301',
          estate: 'KOLAREN 1',
          code: '705L08',
          caption: 'STENTORPSGATAN 7',
          typeCode: 'LEKPLATS',
          typeCaption: 'Lekplats',
        },
      ],
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
    expect(getLeaseSpy).toHaveBeenCalledWith('123', 'true')
    expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
  })

  it('should handle propertyId case', async () => {
    const getRentalPropertyInfoSpy = jest
      .spyOn(propertyManagementAdapter, 'getRentalPropertyInfo')
      .mockResolvedValue(rentalPropertyInfoMock)

    const getLeasesForPropertyIdSpy = jest
      .spyOn(tenantLeaseAdapter, 'getLeasesForPropertyId')
      .mockResolvedValue([leaseMock])

    const res = await request(app.callback()).get(
      '/propertyInfo/456?typeOfNumber=propertyId'
    )

    expect(res.status).toBe(200)
    expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
    expect(getLeasesForPropertyIdSpy).toHaveBeenCalledWith(
      '456',
      undefined,
      'true'
    )
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
    expect(getLeasesForPnrSpy).toHaveBeenCalledWith('123', undefined, 'true')
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
    expect(getLeaseSpy).toHaveBeenCalledWith('123', 'true')
    expect(getRentalPropertyInfoSpy).toHaveBeenCalledWith('456')
  })
})
