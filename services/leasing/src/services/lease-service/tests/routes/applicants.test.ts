import request from 'supertest'
import {
  ApplicantFactory,
  DetailedApplicantFactory,
  LeaseFactory,
  ListingFactory,
} from '../factory'

import * as listingAdapter from '../../adapters/listing-adapter'
import * as estateCodeAdapter from '../../adapters/xpand/estate-code-adapter'
import * as priorityListService from '../../priority-list-service'
import { leaseTypes } from '../../../../constants/leaseTypes'

import Koa from 'koa'
import KoaRouter from '@koa/router'
import { routes } from '../../routes/applicants'
import bodyParser from 'koa-bodyparser'

const app = new Koa()
const router = new KoaRouter()
routes(router)
app.use(bodyParser())
app.use(router.routes())

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
    const listing = ListingFactory.build()

    const applicant = ApplicantFactory.params({
      listingId: listing.id,
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValue(applicant)

    const res = await request(app.callback()).get(
      `/applicants/${applicant.contactCode}/${listing.id}`
    )
    expect(getListingSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body).toBeDefined()
    expect(res.body.id).toEqual(applicant.id)
    expect(res.body.listingId).toEqual(applicant.listingId)
    expect(res.body.name).toEqual(applicant.name)
    expect(res.body.contactCode).toEqual(applicant.contactCode)
    expect(res.body.applicationType).toEqual(applicant.applicationType)
  })
})
describe('GET applicants/validatePropertyRentalRules/:contactCode/:listingId', () => {
  it('responds with 404 if listing does not exist', async () => {
    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/123/456}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Listing was not found')
  })

  it('responds with 404 if property info does not exist', async () => {
    const listing = ListingFactory.build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        return undefined
      })

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/123/456}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Property info for listing was not found')
  })

  it('responds with 200 if rental rules does not apply to property', async () => {
    const listing = ListingFactory.build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [listing.rentalObjectCode]: 'ESTATE_CODE_WITHOUT_RENTAL_RULES',
        }

        return mockData[rentalObjectCode]
      })

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/123/456}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body.reason).toBe(
      'No property rental rules applies to this listing'
    )
  })

  it('responds with 404 if applicant does not exist', async () => {
    const listing = ListingFactory.build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [listing.rentalObjectCode]: '24104',
        }

        return mockData[rentalObjectCode]
      })

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/123/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Applicant was not found')
  })

  it('responds with 403 if applicant does not have a current or upcoming housing contract in same area as listing', async () => {
    const listing = ListingFactory.build()
    const applicant = ApplicantFactory.params({
      listingId: listing.id,
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(applicant)

    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [listing.rentalObjectCode]: '24104',
        }

        return mockData[rentalObjectCode]
      })

    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    const getDetailedApplicantInformationSpy = jest
      .spyOn(priorityListService, 'getDetailedApplicantInformation')
      .mockResolvedValueOnce(detailedApplicant)

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/${applicant.contactCode}/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(getDetailedApplicantInformationSpy).toHaveBeenCalled()
    expect(res.status).toBe(403)
    expect(res.body.reason).toBe(
      'Applicant is not a current or coming tenant in the property'
    )
  })

  it('responds with 403 if user has no current parking space in the same property as listing', async () => {
    const listing = ListingFactory.build()
    const applicant = ApplicantFactory.params({
      listingId: listing.id,
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(applicant)

    const currentHousingContractRentalObjectCode =
      'CURRENT_HOUSING_CONTRACT_RENTAL_OBJECT_CODE'
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        rentalPropertyId: currentHousingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
      parkingSpaceContracts: [],
    })

    //mock the listings property info
    //mock the applicants housing contract property info
    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [listing.rentalObjectCode]: '24104',
          [currentHousingContractRentalObjectCode]: '24104',
        }

        return mockData[rentalObjectCode]
      })

    const getDetailedApplicantInformationSpy = jest
      .spyOn(priorityListService, 'getDetailedApplicantInformation')
      .mockResolvedValueOnce(detailedApplicant)

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/${applicant.contactCode}/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(getDetailedApplicantInformationSpy).toHaveBeenCalled()
    expect(res.status).toBe(403)
    expect(res.body.reason).toBe(
      'User does not have any active parking space contracts in the listings residential area'
    )
  })

  it('responds with 409 if user already has parking space in the same property as listing', async () => {
    const listing = ListingFactory.build()
    const applicant = ApplicantFactory.params({
      listingId: listing.id,
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(applicant)

    const currentHousingContractRentalObjectCode =
      'CURRENT_HOUSING_CONTRACT_RENTAL_OBJECT_CODE'
    const parkingSpaceRentalObjectCode = 'PARKING_SPACE_RENTAL_OBJECT_CODE'
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        rentalPropertyId: currentHousingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
      parkingSpaceContracts: [
        LeaseFactory.build({
          type: leaseTypes.parkingspaceContract,
          rentalPropertyId: parkingSpaceRentalObjectCode,
        }),
      ],
    })

    //mock the listings property info
    //mock the applicants parking space property contract property info
    //mock the applicants housing contract property info
    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [listing.rentalObjectCode]: '24104',
          [currentHousingContractRentalObjectCode]: '24104',
          [parkingSpaceRentalObjectCode]: '24104',
        }

        return mockData[rentalObjectCode]
      })

    const getDetailedApplicantInformationSpy = jest
      .spyOn(priorityListService, 'getDetailedApplicantInformation')
      .mockResolvedValueOnce(detailedApplicant)

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/${applicant.contactCode}/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(getDetailedApplicantInformationSpy).toHaveBeenCalled()
    expect(res.status).toBe(409)
    expect(res.body.reason).toBe(
      'User already have an active parking space contract in the listings residential area'
    )
  })

  it('responds with 403 if user already has parking space but not in the same property as listing', async () => {
    const listing = ListingFactory.build()
    const applicant = ApplicantFactory.params({
      listingId: listing.id,
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(applicant)

    const currentHousingContractRentalObjectCode =
      'CURRENT_HOUSING_CONTRACT_RENTAL_OBJECT_CODE'
    const parkingSpaceRentalObjectCode = 'PARKING_SPACE_RENTAL_OBJECT_CODE'
    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        rentalPropertyId: currentHousingContractRentalObjectCode,
      }),
      upcomingHousingContract: undefined,
      parkingSpaceContracts: [
        LeaseFactory.build({
          type: leaseTypes.parkingspaceContract,
          rentalPropertyId: parkingSpaceRentalObjectCode,
        }),
      ],
    })

    //mock the listings property info
    //mock the applicants parking space property contract property info
    //mock the applicants housing contract property info
    jest
      .spyOn(estateCodeAdapter, 'getEstateCodeFromXpandByRentalObjectCode')
      .mockImplementation(async (rentalObjectCode: string) => {
        const mockData: { [key: string]: string | undefined } = {
          [listing.rentalObjectCode]: '24104',
          [currentHousingContractRentalObjectCode]: '24104',
          [parkingSpaceRentalObjectCode]: 'ESTATE_CODE_FOR_ANOTHER_PROPERTY',
        }

        return mockData[rentalObjectCode]
      })

    const getDetailedApplicantInformationSpy = jest
      .spyOn(priorityListService, 'getDetailedApplicantInformation')
      .mockResolvedValueOnce(detailedApplicant)

    const res = await request(app.callback()).get(
      `/applicants/validatePropertyRentalRules/${applicant.contactCode}/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(getDetailedApplicantInformationSpy).toHaveBeenCalled()
    expect(res.status).toBe(403)
    expect(res.body.reason).toBe(
      'User does not have any active parking space contracts in the listings residential area'
    )
  })
})

describe('GET applicants/validateResidentialAreaRentalRules/:contactCode/:listingId', () => {
  it('responds with 404 if listing does not exist', async () => {
    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/123/456}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Listing was not found')
  })

  it('responds with 404 if applicant does not exist', async () => {
    const listing = ListingFactory.params({
      districtCode: 'OXB',
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(undefined)

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/123/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(res.status).toBe(404)
    expect(res.body.reason).toBe('Applicant was not found')
  })

  it('responds with 200 if rental rules does not apply to listing', async () => {
    const listing = ListingFactory.params({
      districtCode: 'AREA_WHERE_RULES_DO_NOT_APPLY',
    }).build()
    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/123/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body.reason).toBe(
      'No residential area rental rules applies to this listing'
    )
  })

  it('responds with 403 if applicant does not have a current or upcoming housing contract in same area as listing', async () => {
    const listing = ListingFactory.params({
      districtCode: 'OXB',
    }).build()
    const applicant = ApplicantFactory.params({
      listingId: listing.id,
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(applicant)

    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: undefined,
      upcomingHousingContract: undefined,
    })

    const getDetailedApplicantInformationSpy = jest
      .spyOn(priorityListService, 'getDetailedApplicantInformation')
      .mockResolvedValueOnce(detailedApplicant)

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/${applicant.contactCode}/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(getDetailedApplicantInformationSpy).toHaveBeenCalled()
    expect(res.status).toBe(403)
    expect(res.body.reason).toBe(
      'Applicant does not have any current or upcoming housing contracts in the residential area'
    )
  })

  it('responds with 200 if applicant has no current parking space in the same area as listing', async () => {
    const listing = ListingFactory.params({
      districtCode: 'OXB',
    }).build()
    const applicant = ApplicantFactory.params({
      listingId: listing.id,
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(applicant)

    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        residentialArea: { code: 'OXB' },
      }),
      upcomingHousingContract: undefined,
    })

    const getDetailedApplicantInformationSpy = jest
      .spyOn(priorityListService, 'getDetailedApplicantInformation')
      .mockResolvedValueOnce(detailedApplicant)

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/${applicant.contactCode}/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(getDetailedApplicantInformationSpy).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.body.reason).toBe(
      'Applicant does not have any active parking space contracts in the listings residential area. Applicant is eligible to apply to parking space.'
    )
  })

  it('responds with 409 if applicant has a current parking space in the same area as listing', async () => {
    const listing = ListingFactory.params({
      districtCode: 'OXB',
    }).build()
    const applicant = ApplicantFactory.params({
      listingId: listing.id,
    }).build()

    const getListingSpy = jest
      .spyOn(listingAdapter, 'getListingById')
      .mockResolvedValueOnce(listing)

    const getApplicantByContactCodeAndListingIdSpy = jest
      .spyOn(listingAdapter, 'getApplicantByContactCodeAndListingId')
      .mockResolvedValueOnce(applicant)

    const detailedApplicant = DetailedApplicantFactory.build({
      currentHousingContract: LeaseFactory.build({
        residentialArea: { code: 'OXB' },
      }),
      upcomingHousingContract: undefined,
      parkingSpaceContracts: [
        LeaseFactory.build({
          residentialArea: { code: 'OXB' },
        }),
      ],
    })

    const getDetailedApplicantInformationSpy = jest
      .spyOn(priorityListService, 'getDetailedApplicantInformation')
      .mockResolvedValueOnce(detailedApplicant)

    const res = await request(app.callback()).get(
      `/applicants/validateResidentialAreaRentalRules/${applicant.contactCode}/${listing.id}`
    )

    expect(getListingSpy).toHaveBeenCalled()
    expect(getApplicantByContactCodeAndListingIdSpy).toHaveBeenCalled()
    expect(getDetailedApplicantInformationSpy).toHaveBeenCalled()
    expect(res.status).toBe(409)
    expect(res.body.reason).toBe(
      'Applicant already have an active parking space contract in the listings residential area'
    )
  })
})
