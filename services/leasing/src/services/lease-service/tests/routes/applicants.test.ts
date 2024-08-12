import request from 'supertest'
import { Factory } from 'fishery'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'

import * as factory from '../factories'
import * as listingAdapter from '../../adapters/listing-adapter'
import * as estateCodeAdapter from '../../adapters/xpand/estate-code-adapter'
import * as getTenantService from '../../get-tenant'
import { leaseTypes } from '../../../../constants/leaseTypes'
import { routes } from '../../routes/applicants'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
    },
  }
})

const TenantFactory = Factory.define<getTenantService.Tenant>(() => ({
  address: undefined,
  birthDate: new Date(),
  contactCode: '123',
  contactKey: '123',
  emailAddress: 'foo@example.com',
  firstName: 'foo',
  fullName: 'foo bar',
  isTenant: true,
  lastName: 'bar',
  nationalRegistrationNumber: 'foo bar',
  queuePoints: 0,
  phoneNumbers: undefined,
  leaseIds: undefined,
  currentHousingContract: undefined,
  parkingSpaceContracts: undefined,
  upcomingHousingContract: undefined,
}))

beforeEach(jest.restoreAllMocks)
describe('GET /applicants/:contactCode/:listingId', () => {
  it('responds with 404 if no listing found', async () => {
    const getListingSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get('/applicants/123/456')
    expect(getListingSpy).toHaveBeenCalled()
    expect(res.status).toBe(404)
  })

  it('responds with 200 on success', async () => {
    const listing = factory.listing.build()

    const applicant = factory.applicant
      .params({
        listingId: listing.id,
      })
      .build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValue(applicant)

    const res = await request(app.callback()).get(
      `/applicants/${applicant.contactCode}/${listing.id}`
    )
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: applicant.id,
      listingId: applicant.listingId,
      name: applicant.name,
      contactCode: applicant.contactCode,
      applicationType: applicant.applicationType,
    })

    expect(getListingSpy).toHaveBeenCalled()
  })
})

describe('GET applicants/validatePropertyRentalRules/:contactCode/:rentalObjectCode', () => {
  it('responds with 200 if rental rules does not apply to property', async () => {
    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValueOnce({
        type: 'foo',
        estateCode: 'foo',
      })

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/123/foo`
    )

    expect(res.status).toBe(200)
    expect(res.body.reason).toBe(
      'No property rental rules applies to this parking space'
    )
  })

  it('responds with 403 if applicant does not have a current or upcoming housing contract in same area as listing', async () => {
    const listing = factory.listing.build()
    const applicant = factory.applicant
      .params({
        listingId: listing.id,
      })
      .build()

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [listing.rentalObjectCode]: '24104',
        }

        return {
          estateCode: mockData[rentalObjectCode] as string,
          type: 'foo',
        }
      })

    const tenant = TenantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValueOnce({
        ok: true,
        data: tenant,
      })

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/${applicant.contactCode}/${listing.rentalObjectCode}`
    )

    expect(res.status).toBe(403)
    expect(res.body.reason).toBe(
      'User is not a current or coming tenant in the property'
    )
    expect(getTenantSpy).toHaveBeenCalled()
  })

  it('responds with 200 if user has no current parking space in the same property as listing', async () => {
    const listing = factory.listing.build()
    const applicant = factory.applicant
      .params({
        listingId: listing.id,
      })
      .build()

    const currentHousingContractRentalObjectCode =
      'CURRENT_HOUSING_CONTRACT_RENTAL_OBJECT_CODE'
    const tenant = TenantFactory.build({
      currentHousingContract: factory.lease.build({
        rentalPropertyId: currentHousingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
      parkingSpaceContracts: [],
    })

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockResolvedValue({ estateCode: '24104', type: 'bar' })

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValueOnce({
        ok: true,
        data: tenant,
      })

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/${applicant.contactCode}/foo`
    )

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      applicationType: 'Additional',
      reason:
        'User is a tenant in the property and does not have any active parking space contracts in the listings residential area. User is eligible to apply with applicationType additional.',
    })
    expect(getTenantSpy).toHaveBeenCalled()
  })

  it('responds with 200 and applicationType Replace if user already has parking space in the same property as listing', async () => {
    const listing = factory.listing.build()
    const applicant = factory.applicant
      .params({
        listingId: listing.id,
      })
      .build()

    const currentHousingContractRentalObjectCode =
      'CURRENT_HOUSING_CONTRACT_RENTAL_OBJECT_CODE'
    const parkingSpaceRentalObjectCode = 'PARKING_SPACE_RENTAL_OBJECT_CODE'

    const tenant = TenantFactory.build({
      currentHousingContract: factory.lease.build({
        rentalPropertyId: currentHousingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
      parkingSpaceContracts: [
        factory.lease.build({
          type: leaseTypes.parkingspaceContract,
          rentalPropertyId: parkingSpaceRentalObjectCode,
        }),
      ],
    })

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [currentHousingContractRentalObjectCode]: '24104',
          [parkingSpaceRentalObjectCode]: '24104',
        }

        return {
          estateCode: mockData[rentalObjectCode] as string,
          type: 'foo',
        }
      })

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValueOnce({
        ok: true,
        data: tenant,
      })

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/${applicant.contactCode}/${parkingSpaceRentalObjectCode}`
    )

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      applicationType: 'Replace',
      reason:
        'User already have an active parking space contract in the listings residential area. User is eligible to apply with applicationType Replace.',
    })
    expect(getTenantSpy).toHaveBeenCalled()
  })

  it('responds with 200 if user already has parking space but not in the same property as listing', async () => {
    const listing = factory.listing.build()
    const applicant = factory.applicant
      .params({
        listingId: listing.id,
      })
      .build()

    const currentHousingContractRentalObjectCode =
      'CURRENT_HOUSING_CONTRACT_RENTAL_OBJECT_CODE'
    const parkingSpaceRentalObjectCode = 'PARKING_SPACE_RENTAL_OBJECT_CODE'
    const tenant = TenantFactory.build({
      currentHousingContract: factory.lease.build({
        rentalPropertyId: currentHousingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
      parkingSpaceContracts: [
        factory.lease.build({
          type: leaseTypes.parkingspaceContract,
          rentalPropertyId: 'foo',
        }),
      ],
    })

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [currentHousingContractRentalObjectCode]: '24104',
          [parkingSpaceRentalObjectCode]: '24104',
        }

        return {
          estateCode: mockData[rentalObjectCode] as string,
          type: 'foo',
        }
      })

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValueOnce({
        ok: true,
        data: tenant,
      })

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/${applicant.contactCode}/${parkingSpaceRentalObjectCode}`
    )

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      applicationType: 'Additional',
      reason:
        'User is a tenant in the property and does not have any active parking space contracts in the listings residential area. User is eligible to apply with applicationType additional.',
    })

    expect(getTenantSpy).toHaveBeenCalled()
  })
})

describe('GET applicants/validateResidentialAreaRentalRules/:contactCode/:districtCode', () => {
  it('responds with 200 if rental rules does not apply to listing', async () => {
    const listing = factory.listing
      .params({
        districtCode: 'AREA_WHERE_RULES_DO_NOT_APPLY',
      })
      .build()

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/123/${listing.districtCode}`
    )

    expect(res.status).toBe(200)
    expect(res.body.reason).toBe(
      'No residential area rental rules applies to this parking space'
    )
  })

  it('responds with 403 if applicant does not have a current or upcoming housing contract in same area as listing', async () => {
    const listing = factory.listing
      .params({
        districtCode: 'OXB',
      })
      .build()
    const applicant = factory.applicant
      .params({
        listingId: listing.id,
      })
      .build()

    const tenant = TenantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValueOnce({ ok: true, data: tenant })

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/${applicant.contactCode}/${listing.districtCode}`
    )

    expect(res.status).toBe(403)
    expect(res.body.reason).toBe(
      'Subject does not have any current or upcoming housing contracts in the residential area'
    )
    expect(getTenantSpy).toHaveBeenCalled()
  })

  it('responds with 200 if applicant has no current parking space in the same area as listing', async () => {
    const listing = factory.listing
      .params({
        districtCode: 'OXB',
      })
      .build()
    const applicant = factory.applicant
      .params({
        listingId: listing.id,
      })
      .build()

    const tenant = TenantFactory.build({
      currentHousingContract: factory.lease.build({
        residentialArea: { code: 'OXB' },
      }),
      upcomingHousingContract: undefined,
    })

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValueOnce({ ok: true, data: tenant })

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/${applicant.contactCode}/${listing.districtCode}`
    )

    expect(res.status).toBe(200)
    expect(res.body.reason).toBe(
      'Subject does not have any active parking space contracts in the listings residential area. Subject is eligible to apply to parking space with applicationType additional.'
    )

    expect(getTenantSpy).toHaveBeenCalled()
  })

  it('responds with 200 and applicationType "Replace" if applicant has a current parking space in the same area as listing', async () => {
    const listing = factory.listing
      .params({
        districtCode: 'OXB',
      })
      .build()
    const applicant = factory.applicant
      .params({
        listingId: listing.id,
      })
      .build()

    const tenant = TenantFactory.build({
      currentHousingContract: factory.lease.build({
        residentialArea: { code: 'OXB' },
      }),
      upcomingHousingContract: undefined,
      parkingSpaceContracts: [
        factory.lease.build({
          residentialArea: { code: 'OXB' },
        }),
      ],
    })

    const getTenantSpy = jest
      .spyOn(getTenantService, 'getTenant')
      .mockResolvedValueOnce({ ok: true, data: tenant })

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/${applicant.contactCode}/${listing.districtCode}`
    )

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      applicationType: 'Replace',
      reason:
        'Subject already have an active parking space contract in the listings residential area. Subject is eligible to apply to parking space with applicationType replace.',
    })
    expect(getTenantSpy).toHaveBeenCalled()
  })
})
