import {
  CreateOfferErrorCodes,
  ListingStatus,
  UpdateListingStatusErrorCodes,
} from 'onecore-types'

import { createOfferForInternalParkingSpace } from '../create-offer'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as propertyMgmtAdapter from '../../../../adapters/property-management-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import * as factory from '../../../../../test/factories'
import { ProcessStatus } from '../../../../common/types'

describe('createOfferForInternalParkingSpace', () => {
  afterEach(() => {
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

    jest.spyOn(propertyMgmtAdapter, 'getParkingSpaceByCode').mockResolvedValue({
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

    jest.spyOn(propertyMgmtAdapter, 'getParkingSpaceByCode').mockResolvedValue({
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
        message: 'No eligible applicant found, cannot create new offer',
        errorCode: CreateOfferErrorCodes.NoApplicants,
      },
    })
  })

  it('fails if updating listing status fails', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(propertyMgmtAdapter, 'getParkingSpaceByCode').mockResolvedValue({
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
        message: 'Error updating listing status to NoApplicants',
        errorCode: CreateOfferErrorCodes.UpdateListingStatusFailure,
      },
    })
  })

  it('passes applicants that are not eligible for renting in area with specific rental rule', async () => {
    const rentalObject = factory.rentalObject
      .params({
        restidentalAreaCaption: 'Centrum',
        restidentalAreaCode: 'CEN',
      })
      .build()

    const listing = factory.listing.build({
      status: ListingStatus.Expired,
      rentalObject: rentalObject,
    })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(propertyMgmtAdapter, 'getParkingSpaceByCode').mockResolvedValue({
      ok: true,
      data: factory.vacantParkingSpace
        .params({
          rentalObjectCode: listing.rentalObjectCode,
        })
        .build(),
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
          priority: undefined,
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
      .spyOn(leasingAdapter, 'updateApplicantStatus')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(communicationAdapter, 'sendParkingSpaceOfferEmail')
      .mockResolvedValueOnce(null)
    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })

    const result = await createOfferForInternalParkingSpace(123)

    expect(leasingAdapter.updateApplicantStatus).toHaveBeenCalledWith({
      applicantId: 432,
      contactCode: '456DEF',
      status: 6,
    })

    expect(result).toEqual({
      processStatus: ProcessStatus.successful,
      data: null,
      httpStatus: 200,
    })
  })

  it.todo(
    'passes applicants that is not eligible because of bad credit check and updates their rejection status???'
  )

  it('fails if retrieving contact information fails', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(propertyMgmtAdapter, 'getParkingSpaceByCode').mockResolvedValue({
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
      .mockResolvedValueOnce({ ok: false, err: 'unknown' })

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

  it('fails if update applicant status fails', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(propertyMgmtAdapter, 'getParkingSpaceByCode').mockResolvedValue({
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
      .mockRejectedValueOnce(null)

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.failed,
      error: CreateOfferErrorCodes.UpdateApplicantStatusFailure,
      httpStatus: 500,
      response: {
        message: 'Update Applicant Status failed',
        errorCode: CreateOfferErrorCodes.UpdateApplicantStatusFailure,
      },
    })
  })

  it('fails if create offer fails', async () => {
    const listing = factory.listing.build({ status: ListingStatus.Expired })
    jest
      .spyOn(leasingAdapter, 'getListingByListingId')
      .mockResolvedValue(listing)

    jest.spyOn(propertyMgmtAdapter, 'getParkingSpaceByCode').mockResolvedValue({
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

    jest.spyOn(propertyMgmtAdapter, 'getParkingSpaceByCode').mockResolvedValue({
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
      .mockResolvedValueOnce(null)

    jest
      .spyOn(leasingAdapter, 'createOffer')
      .mockResolvedValueOnce({ ok: true, data: factory.offer.build() })

    const updateOfferSentAtSpy = jest
      .spyOn(leasingAdapter, 'updateOfferSentAt')
      .mockResolvedValue({ ok: true, data: null })

    const result = await createOfferForInternalParkingSpace(123)

    expect(result).toEqual({
      processStatus: ProcessStatus.successful,
      data: null,
      httpStatus: 200,
    })

    expect(updateOfferSentAtSpy).toHaveBeenCalledTimes(1)
  })
})
