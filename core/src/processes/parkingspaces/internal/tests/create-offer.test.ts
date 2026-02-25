import {
  ApplicantStatus,
  CreateOfferErrorCodes,
  ListingStatus,
  UpdateListingStatusErrorCodes,
} from '@onecore/types'

import {
  createOfferForInternalParkingSpace,
  isEligibleForOffer,
} from '../create-offer'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import * as factory from '../../../../../test/factories'
import { ProcessStatus } from '../../../../common/types'

describe('createOfferForInternalParkingSpace', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      advanceTimers: false,
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick'],
    })
  })

  afterEach(() => {
    jest.useRealTimers()

    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  jest
    .spyOn(communicationAdapter, 'sendNotificationToRole')
    .mockResolvedValue(null)

  it('fails if there is no listing', async () => {
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValueOnce(undefined)

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: CreateOfferErrorCodes.NoListing,
      httpStatus: 500,
      response: {
        errorCode: CreateOfferErrorCodes.NoListing,
        message: 'Listing with id 123 not found',
      },
    })
  })

  it('fails if listing is not expired', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Active })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: CreateOfferErrorCodes.ListingNotExpired,
      httpStatus: 500,
      response: {
        message: 'Listing with id 123 not expired',
        errorCode: CreateOfferErrorCodes.ListingNotExpired,
      },
    })
  })

  it('fails if there are no applicants', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })
    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: [] })

    jest
      .spyOn(leasingAdapter, 'updateListingStatus')
      .mockResolvedValueOnce({ ok: true, data: null })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: CreateOfferErrorCodes.NoApplicants,
      httpStatus: 500,
      response: {
        message: 'No eligible applicant found, no offer created.',
        errorCode: CreateOfferErrorCodes.NoApplicants,
      },
    })
  })

  it('fails if updating listing status fails', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })
    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: [] })

    jest.spyOn(leasingAdapter, 'updateListingStatus').mockResolvedValueOnce({
      ok: false,
      err: UpdateListingStatusErrorCodes.NotFound,
    })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: CreateOfferErrorCodes.UpdateListingStatusFailure,
      httpStatus: 500,
      response: {
        message: 'Error updating listing status to Closed.',
        errorCode: CreateOfferErrorCodes.UpdateListingStatusFailure,
      },
    })
  })

  it('passes applicants that are not eligible for renting in area with specific rental rule', async () => {
    const rentalObject = factory.rentalObject
      .params({
        residentialAreaCaption: 'Centrum',
        residentialAreaCode: 'CEN',
      })
      .build()

    const listing = factory.listing.build({
      status: ListingStatus.Expired,
      rentalObject: rentalObject,
    })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })

    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValueOnce({
        ok: false,
        err: {
          tag: 'no-housing-contract-in-the-area',
          data: {},
        },
      })
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })

    const applicants = [
      factory.detailedApplicant
        .params({
          id: 432,
          contactCode: '456DEF',
          priority: 1,
        })
        .build(),
      factory.detailedApplicant
        .params({
          id: 987,
          contactCode: '123ABC',
          priority: 2,
        })
        .build(),
    ]

    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: applicants })
    jest
      .spyOn(leasingAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })

    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce({ ok: true, data: null })
    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })
    jest
      .spyOn(leasingAdapter, 'updateOfferSentAt')
      .mockResolvedValue({ ok: true, data: null })

    const result = await createOfferForInternalParkingSpace(123)

    expect(leasingAdapter.updateApplicantStatus).toHaveBeenCalledWith({
      applicantId: 987,
      contactCode: '123ABC',
      status: 6,
    })

    expect(result).toEqual({
      processStatus: ProcessStatus.successful,
      data: null,
      httpStatus: 200,
    })
  })

  it('skips applicants that fail property rental rules validation and selects the next eligible applicant', async () => {
    const rentalObject = factory.rentalObject
      .params({
        residentialAreaCaption: 'Centrum',
        residentialAreaCode: 'CEN',
      })
      .build()

    const listing = factory.listing.build({
      status: ListingStatus.Expired,
      rentalObject: rentalObject,
    })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })

    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValueOnce({
        ok: false,
        err: {
          tag: 'not-tenant-in-the-property',
          data: {},
        },
      })
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })

    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')

      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })

    const applicants = [
      factory.detailedApplicant
        .params({
          id: 432,
          contactCode: '456DEF',
          priority: 1,
        })
        .build(),
      factory.detailedApplicant
        .params({
          id: 987,
          contactCode: '123ABC',
          priority: 2,
        })
        .build(),
    ]

    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({ ok: true, data: applicants })
    jest
      .spyOn(leasingAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })

    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce({ ok: true, data: null })
    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })
    jest
      .spyOn(leasingAdapter, 'updateOfferSentAt')
      .mockResolvedValue({ ok: true, data: null })

    const result = await createOfferForInternalParkingSpace(123)

    expect(leasingAdapter.updateApplicantStatus).toHaveBeenCalledWith({
      applicantId: 987,
      contactCode: '123ABC',
      status: 6,
    })

    expect(result).toEqual({
      processStatus: ProcessStatus.successful,
      data: null,
      httpStatus: 200,
    })
  })

  it('fails if retrieving contact information fails', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })
    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.detailedApplicant.buildList(1, {
          contactCode: 'P158773',
        }),
      })
    jest
      .spyOn(leasingAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: CreateOfferErrorCodes.NoContact,
      httpStatus: 500,
      response: {
        message: 'Could not find contact P158773',
        errorCode: CreateOfferErrorCodes.NoContact,
      },
    })
  })

  it('fails if create offer fails', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })
    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.detailedApplicant.buildList(1),
      })
    jest
      .spyOn(leasingAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: CreateOfferErrorCodes.CreateOfferFailure,
      httpStatus: 500,
      response: {
        message: 'Create Offer failed',
        errorCode: CreateOfferErrorCodes.CreateOfferFailure,
      },
    })
  })

  it('creates offer', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })
    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.detailedApplicant.buildList(1),
      })
    jest
      .spyOn(leasingAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)

    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce({ ok: true, data: null })
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })

    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.successful,
      data: null,
      httpStatus: 200,
    })
  })

  it('creates offer that expires at midnight 3 business days from a monday', async () => {
    //set system time to 2025-08-11T06:00:00Z which is a monday
    const startTime = new Date('2025-08-11T06:00:00Z')
    jest.setSystemTime(startTime)

    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })

    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.detailedApplicant.buildList(1),
      })
    jest
      .spyOn(leasingAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)

    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce({ ok: true, data: null })
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    const createOfferSpy = jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })

    await createOfferForInternalParkingSpace(123)

    expect(createOfferSpy).toHaveBeenCalledTimes(1)

    const expiresAt = createOfferSpy.mock.calls[0][0].expiresAt
    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt.getUTCFullYear()).toBe(2025)
    expect(expiresAt.getUTCMonth()).toBe(7) // August is 7 (0-indexed)
    expect(expiresAt.getUTCDate()).toBe(14)
    expect(expiresAt.getUTCHours()).toBe(23)
    expect(expiresAt.getUTCMinutes()).toBe(59)
  })

  it('creates offer that expires at midnight 3 business days from a friday', async () => {
    //set system time to 2025-08-08T06:00:00Z which is a friday
    const startTime = new Date('2025-08-08T06:00:00Z')
    jest.setSystemTime(startTime)

    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
    })

    jest
      .spyOn(leasingAdapter, 'getDetailedApplicantsByListingId')
      .mockResolvedValueOnce({
        ok: true,
        data: factory.detailedApplicant.buildList(1),
      })
    jest
      .spyOn(leasingAdapter, 'getContactByContactCode')
      .mockResolvedValueOnce({ ok: true, data: factory.contact.build() })
    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)

    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce({ ok: true, data: null })
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Additional' },
      })
    const createOfferSpy = jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })

    await createOfferForInternalParkingSpace(123)

    expect(createOfferSpy).toHaveBeenCalledTimes(1)

    const expiresAt = createOfferSpy.mock.calls[0][0].expiresAt
    expect(expiresAt).toBeInstanceOf(Date)
    expect(expiresAt.getUTCFullYear()).toBe(2025)
    expect(expiresAt.getUTCMonth()).toBe(7) // August is 7 (0-indexed)
    expect(expiresAt.getUTCDate()).toBe(13)
    expect(expiresAt.getUTCHours()).toBe(23)
    expect(expiresAt.getUTCMinutes()).toBe(59)
  })

  it('should fail on attempting to create listing on rental object with no vacantFrom date', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(leasingAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
          vacantFrom: undefined,
        })
        .build(),
    })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toMatchObject({
      processStatus: ProcessStatus.failed,
      httpStatus: 500,
      response: {
        errorCode: 'rental-object-not-vacant',
      },
    })
  })
})

describe('isEligibleForOffer', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      advanceTimers: false,
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick'],
    })
  })

  afterEach(() => {
    jest.useRealTimers()

    jest.clearAllMocks()
    jest.resetAllMocks()
  })

  it('should call validateResidentialAreaRentalRules and validatePropertyRentalRules with correct arguments', async () => {
    const listing = factory.listing.build({
      rentalObject: factory.rentalObject.build({
        residentialAreaCode: 'AREA123',
        rentalObjectCode: 'OBJ456',
      }),
      rentalObjectCode: 'OBJ456',
    })
    const applicant = factory.detailedApplicant.build({
      contactCode: 'CONTACT789',
      id: 1,
      status: ApplicantStatus.Active,
      priority: 1,
      applicationType: 'Replace',
    })
    const log: string[] = []

    const validateResidentialAreaRentalRulesSpy = jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })

    const validatePropertyRentalRulesSpy = jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })

    await isEligibleForOffer(listing, applicant, log)

    expect(validateResidentialAreaRentalRulesSpy).toHaveBeenCalledWith(
      applicant.contactCode,
      listing.rentalObject.residentialAreaCode
    )
    expect(validatePropertyRentalRulesSpy).toHaveBeenCalledWith(
      applicant.contactCode,
      listing.rentalObjectCode
    )
  })
  it('should update status to Disqualified if a user doesnt pass validation', async () => {
    const listing = factory.listing.build({
      rentalObject: factory.rentalObject.build({
        residentialAreaCode: 'AREA123',
        rentalObjectCode: 'OBJ456',
      }),
      rentalObjectCode: 'OBJ456',
    })
    const applicant = factory.detailedApplicant.build({
      contactCode: 'CONTACT789',
      id: 1,
      status: ApplicantStatus.Active,
      priority: 1,
      applicationType: 'Replace',
    })
    const log: string[] = []

    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValueOnce({
        ok: false,
        err: {
          tag: 'no-housing-contract-in-the-area',
          data: {},
        },
      })

    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })

    const updateApplicantStatusSpy = jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValue(null)

    const result = await isEligibleForOffer(listing, applicant, log)

    expect(result).toBe(false)
    expect(updateApplicantStatusSpy).toHaveBeenCalledWith({
      applicantId: applicant.id,
      contactCode: applicant.contactCode,
      status: ApplicantStatus.Disqualified,
    })
    expect(log).toContain(
      `Updated status for disqualified applicant ${applicant.id} due to failing rental rules validation`
    )
  })

  it('should return false and update applicant status to Disqualified if residential area rental rule validation fails', async () => {
    const listing = factory.listing.build({
      rentalObject: factory.rentalObject.build({
        residentialAreaCode: 'AREA123',
        rentalObjectCode: 'OBJ456',
      }),
      rentalObjectCode: 'OBJ456',
    })
    const applicant = factory.detailedApplicant.build({
      contactCode: 'CONTACT789',
      id: 1,
      status: ApplicantStatus.Active,
      priority: 1,
      applicationType: 'Replace',
    })
    const log: string[] = []

    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: false,
        err: {
          tag: 'no-housing-contract-in-the-area',
          data: {},
        },
      })
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })

    const updateApplicantStatusSpy = jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValue(null)

    const result = await isEligibleForOffer(listing, applicant, log)

    expect(result).toBe(false)
    expect(updateApplicantStatusSpy).toHaveBeenCalledWith({
      applicantId: applicant.id,
      contactCode: applicant.contactCode,
      status: ApplicantStatus.Disqualified,
    })
  })

  it('should return false and update applicant status to Disqualified if property rental rule validation fails', async () => {
    const listing = factory.listing.build({
      rentalObject: factory.rentalObject.build({
        residentialAreaCode: 'AREA123',
        rentalObjectCode: 'OBJ456',
      }),
      rentalObjectCode: 'OBJ456',
    })
    const applicant = factory.detailedApplicant.build({
      contactCode: 'CONTACT789',
      id: 1,
      status: ApplicantStatus.Active,
      priority: 1,
      applicationType: 'Replace',
    })
    const log: string[] = []

    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: false,
        err: { tag: 'not-tenant-in-the-property', data: {} },
      })

    const updateApplicantStatusSpy = jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValue(null)

    const result = await isEligibleForOffer(listing, applicant, log)

    expect(result).toBe(false)
    expect(updateApplicantStatusSpy).toHaveBeenCalledWith({
      applicantId: applicant.id,
      contactCode: applicant.contactCode,
      status: ApplicantStatus.Disqualified,
    })
  })

  it('should log disqualification reason if applicant fails rental rule validation', async () => {
    const listing = factory.listing.build({
      rentalObject: factory.rentalObject.build({
        residentialAreaCode: 'AREA123',
        rentalObjectCode: 'OBJ456',
      }),
      rentalObjectCode: 'OBJ456',
    })
    const applicant = factory.detailedApplicant.build({
      contactCode: 'CONTACT789',
      id: 1,
      status: ApplicantStatus.Active,
      priority: 1,
      applicationType: 'Replace',
    })
    const log: string[] = []

    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: false,
        err: { tag: 'no-housing-contract-in-the-area', data: {} },
      })
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })

    jest.spyOn(leasingAdapter, 'updateApplicantStatus').mockResolvedValue(null)

    await isEligibleForOffer(listing, applicant, log)

    expect(log).toContain(
      `Updated status for disqualified applicant ${applicant.id} due to failing rental rules validation`
    )
  })

  it('should handle errors from updateApplicantStatus gracefully and log them', async () => {
    const listing = factory.listing.build({
      rentalObject: factory.rentalObject.build({
        residentialAreaCode: 'AREA123',
        rentalObjectCode: 'OBJ456',
      }),
      rentalObjectCode: 'OBJ456',
    })
    const applicant = factory.detailedApplicant.build({
      contactCode: 'CONTACT789',
      id: 1,
      status: ApplicantStatus.Active,
      priority: 1,
      applicationType: 'Replace',
    })
    const log: string[] = []

    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: false,
        err: { tag: 'no-housing-contract-in-the-area', data: {} },
      })
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })

    jest
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockRejectedValue(new Error('Update failed'))

    await isEligibleForOffer(listing, applicant, log)

    expect(log.some((entry) => entry.includes('Update failed'))).toBe(true)
  })

  it('should return true if applicant passes both validations and updateApplicantStatus is not called', async () => {
    const listing = factory.listing.build({
      rentalObject: factory.rentalObject.build({
        residentialAreaCode: 'AREA123',
        rentalObjectCode: 'OBJ456',
      }),
      rentalObjectCode: 'OBJ456',
    })
    const applicant = factory.detailedApplicant.build({
      contactCode: 'CONTACT789',
      id: 1,
      status: ApplicantStatus.Active,
      priority: 1,
      applicationType: 'Replace',
    })
    const log: string[] = []

    jest
      .spyOn(leasingAdapter, 'validateResidentialAreaRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })
    jest
      .spyOn(leasingAdapter, 'validatePropertyRentalRules')
      .mockResolvedValue({
        ok: true,
        data: { reason: '', applicationType: 'Replace' },
      })

    const updateApplicantStatusSpy = jest.spyOn(
      leasingAdapter,
      'updateApplicantStatus'
    )

    const result = await isEligibleForOffer(listing, applicant, log)

    expect(result).toBe(true)
    expect(updateApplicantStatusSpy).not.toHaveBeenCalled()
  })
})
